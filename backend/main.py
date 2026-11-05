"""
main.py â€” StraightMoney FastAPI application entry point.

Exposes 12 REST endpoints covering campaigns, donations, invoices (with
AI-assisted extraction + policy + advisory checks), human verification,
payout triggering, and the public ledger.
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import hashlib
import math
from decimal import Decimal
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    Request,
    Response,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy import or_, text

import audit
import advisory as advisory_module
import extraction as extraction_module
from config import settings
from db import get_db, init_db, SessionLocal
from models import (
    StoredFile,
    AuditLog,
    PayoutInstallment,
    BudgetLine,
    Campaign,
    Check,
    Donation,
    DeliveryCloseout,
    Invoice,
    PaymentAdjustment,
    Payout,
    Vendor,
    Verification,
)
from payments import PayPalClient, PayPalError
from installments import pay_available, pay_campaign
from policy import run_policy_checks
from schemas import (
    AdvisoryResult,
    CampaignCreate,
    CampaignCancellation,
    CampaignDetail,
    CampaignOut,
    DonationCaptureOut,
    DonationCreate,
    DonationCreateOut,
    DonationOut,
    DeliveryReport,
    DeliveryAcceptance,
    DeliveryCloseoutOut,
    ExtractionResult,
    InvoiceDetail,
    InvoiceOut,
    LedgerEntry,
    LedgerQuestion,
    LedgerAnswer,
    VerificationCreate,
    VerificationOut,
)
from seed import seed_demo_data
from uploads import read_upload, validate_content, file_response
from guards import UploadSizeLimit
from auth import router as auth_router, require_organizer, require_vendor, require_verifier
from reconciliation import process_webhook
from finance import record_refund_total, record_refund_request

# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------

app = FastAPI(
    title="StraightMoney API",
    version="1.0.0",
    description="Transparent fundraising with AI-assisted invoice verification.",
)

app.add_middleware(UploadSizeLimit)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def protect_requests(request, call_next):
    if request.method == "POST":
        try:
            length = request.headers.get("content-length")
            if length is not None and int(length) > settings.max_upload_bytes * 2 + 65536:
                raise HTTPException(413, "Request exceeds upload limit.")
        except ValueError:
            return file_response_error(400, "Invalid Content-Length.")
        except HTTPException as exc:
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def file_response_error(code, message):
    from fastapi.responses import JSONResponse
    return JSONResponse({"detail": message}, status_code=code)


@app.get("/files/{file_id}/{filename}")
@app.get("/api/files/{file_id}/{filename}")
@app.get("/files/{file_id}")
@app.get("/api/files/{file_id}")
def get_stored_file(file_id: int, filename: str | None = None, db: Session = Depends(get_db)):
    stored = _get_or_404(db, StoredFile, file_id)
    return file_response(stored.data, stored.mime_type)


@app.get("/uploads/{filename}")
@app.get("/api/uploads/{filename}")
async def get_legacy_file(filename: str):
    root = Path(settings.upload_dir).resolve()
    path = (root / filename).resolve()
    if path.parent != root or not path.is_file() or path.stat().st_size > settings.max_upload_bytes:
        raise HTTPException(404, "File not found.")
    data = await run_in_threadpool(path.read_bytes)
    mime, _ = await run_in_threadpool(validate_content, data)
    return file_response(data, mime)


router = APIRouter()


@app.get("/", tags=["Info"])
@app.get("/api", tags=["Info"])
def root_info():
    """Root info endpoint â€” ensures visiting http://localhost:8000/ never shows 404."""
    return {
        "app": "StraightMoney API",
        "description": "Community fundraising where the organizer never holds the money (PayPal AI Hackathon)",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs",
        "endpoints": {
            "campaigns": "/campaigns",
            "campaign_detail": "/campaigns/1",
            "invoices": "/invoices",
            "ledger": "/campaigns/1/ledger",
            "swagger_docs": "/docs",
            "redoc_docs": "/redoc",
        },
    }


@app.get("/health", tags=["Info"])
@app.get("/api/health", tags=["Info"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(503, "Database is unavailable.") from exc
    return {"status": "ok", "app": "StraightMoney"}


@app.on_event("startup")
async def on_startup() -> None:
    """Initialise the database and seed demo data on first boot."""
    init_db()
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

paypal = PayPalClient()

def _invoice_to_detail(inv: Invoice) -> InvoiceDetail:
    return InvoiceDetail.model_validate(inv)


def _guard_invoice_status(inv: Invoice, required: str) -> None:
    if inv.status != required:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invoice is in status '{inv.status}', expected '{required}'.",
        )


def _get_or_404(db: Session, model, entity_id: int):
    obj = db.get(model, entity_id)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} {entity_id} not found.")
    return obj


def _locked_invoice(db: Session, invoice_id: int) -> Invoice:
    initial = _get_or_404(db, Invoice, invoice_id)
    db.query(Campaign).filter_by(id=initial.campaign_id).with_for_update().populate_existing().one()
    return db.query(Invoice).filter_by(id=invoice_id).with_for_update().populate_existing().one()


def _recheck_approval(db: Session, invoice: Invoice) -> None:
    campaign, line, vendor = invoice.campaign, invoice.budget_line, invoice.vendor
    db.refresh(line)
    others = db.query(Invoice).filter(Invoice.campaign_id == campaign.id, Invoice.id != invoice.id).all()
    committed = sum(other.remaining_amount for other in others
                    if other.budget_line_id == line.id and other.status != "PAID"
                    and any(v.decision in {"approve", "test_override"} for v in other.verifications))
    proof = any(file.kind == "proof" for file in invoice.files)
    if not proof and invoice.evidence_path and invoice.evidence_path != invoice.raw_file_path:
        path = Path(settings.upload_dir) / Path(invoice.evidence_path).name
        try:
            if path.stat().st_size <= settings.max_upload_bytes:
                validate_content(path.read_bytes(), proof=True)
                proof = True
        except (OSError, HTTPException):
            pass
    checks = run_policy_checks({"amount": invoice.amount, "committed_amount": committed,
        "document_hash": invoice.document_hash,
        "invoice_number": invoice.invoice_number, "payout_email": invoice.payout_email,
        "currency": invoice.currency, "proof_file_attached": proof}, campaign, line, vendor,
        [other for other in others if other.id < invoice.id])
    failures = [check.detail for check in checks if not check.passed and check.severity == "hard"]
    if line.campaign_id != campaign.id or vendor.campaign_id != campaign.id:
        failures.append("Vendor and budget line must belong to this campaign.")
    if failures:
        raise HTTPException(409, "Approval checks failed: " + "; ".join(failures))


# ---------------------------------------------------------------------------
# Endpoint 1 â€” Create campaign
# ---------------------------------------------------------------------------


@router.post("/campaigns", response_model=CampaignDetail, status_code=201, dependencies=[Depends(require_organizer)])
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db), request: Request = None):
    """Create a new fundraising campaign with optional vendors and budget lines."""
    campaign = Campaign(
        title=payload.title,
        description=payload.description,
        goal_amount=payload.goal_amount,
        currency=payload.currency,
        organizer_name=request.state.actor.name if request is not None else payload.organizer_name,
        organizer_user_id=request.state.actor.id if request is not None else None,
        status="active",
        pool_balance=0.0,
    )
    db.add(campaign)
    db.flush()

    vendor_by_email: dict[str, Vendor] = {}
    for idx, v in enumerate(payload.vendors):
        vendor = Vendor(
            campaign_id=campaign.id,
            name=v.name,
            payout_email=v.payout_email,
        )
        db.add(vendor)
        db.flush()
        vendor_by_email[v.payout_email.strip().lower()] = vendor

    for bl in payload.budget_lines:
        vendor_id = bl.vendor_id
        if vendor_id is not None and vendor_id not in {vendor.id for vendor in vendor_by_email.values()}:
            raise HTTPException(422, "Vendor must belong to the newly created campaign.")
        if not vendor_id and bl.vendor_name and bl.vendor_payout_email:
            email_key = bl.vendor_payout_email.strip().lower()
            if email_key not in vendor_by_email:
                new_vendor = Vendor(
                    campaign_id=campaign.id,
                    name=bl.vendor_name.strip(),
                    payout_email=bl.vendor_payout_email.strip(),
                )
                db.add(new_vendor)
                db.flush()
                vendor_by_email[email_key] = new_vendor
            vendor_id = vendor_by_email[email_key].id

        budget_line = BudgetLine(
            campaign_id=campaign.id,
            name=bl.name,
            vendor_id=vendor_id,
            budgeted_amount=bl.budgeted_amount,
        )
        db.add(budget_line)

    db.commit()
    db.refresh(campaign)
    audit.log(db, actor="system", action="campaign.created", campaign_id=campaign.id)
    return CampaignDetail.model_validate(campaign)


# ---------------------------------------------------------------------------
# Endpoint 2 â€” Get campaign detail
# ---------------------------------------------------------------------------


@router.get("/campaigns/{campaign_id}", response_model=CampaignDetail)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Retrieve full campaign detail including vendors and budget lines."""
    campaign = _get_or_404(db, Campaign, campaign_id)
    return CampaignDetail.model_validate(campaign)


# ---------------------------------------------------------------------------
# Endpoint 3 â€” List campaigns
# ---------------------------------------------------------------------------


@router.get("/campaigns", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db)):
    """Return a summary list of all campaigns."""
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    return [CampaignOut.model_validate(c) for c in campaigns]


@router.post("/campaigns/{campaign_id}/cancel", response_model=CampaignDetail, dependencies=[Depends(require_organizer)])
def cancel_campaign(campaign_id: int, payload: CampaignCancellation, request: Request, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter_by(id=campaign_id).with_for_update().one_or_none()
    if campaign is None or campaign.organizer_user_id != request.state.actor.id:
        raise HTTPException(404, "Campaign not found in your workspace.")
    if campaign.status != "active":
        raise HTTPException(409, "Only an active campaign can be cancelled.")
    pending = db.query(PayoutInstallment).join(Invoice).filter(
        Invoice.campaign_id == campaign_id, PayoutInstallment.status == "pending").first()
    legacy_pending = db.query(Payout).join(Invoice).filter(
        Invoice.campaign_id == campaign_id, Payout.status == "pending").first()
    if pending or legacy_pending:
        raise HTTPException(409, "Wait for pending PayPal payouts to settle before cancelling.")
    campaign.status = "closed"
    campaign.cancellation_reason = payload.reason
    campaign.cancelled_at = datetime.now(timezone.utc).replace(tzinfo=None)
    audit.log(db, actor=f"organizer:{request.state.actor.email}", action="campaign.cancelled",
              campaign_id=campaign_id, detail={"reason": payload.reason}, commit=False)
    db.commit()
    db.refresh(campaign)
    return CampaignDetail.model_validate(campaign)


@router.get("/campaigns/{campaign_id}/donations", response_model=list[DonationOut], dependencies=[Depends(require_organizer)])
def organizer_donations(campaign_id: int, request: Request, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.organizer_user_id != request.state.actor.id:
        raise HTTPException(404, "Campaign not found in your workspace.")
    return [DonationOut.model_validate(row) for row in db.query(Donation).filter_by(campaign_id=campaign_id).all()]


@router.post("/donations/{donation_id}/refund", response_model=DonationOut, dependencies=[Depends(require_organizer)])
async def refund_donation(donation_id: int, request: Request, db: Session = Depends(get_db)):
    initial = db.get(Donation, donation_id)
    if initial is None:
        raise HTTPException(404, "Donation not found in your workspace.")
    db.query(Campaign).filter_by(id=initial.campaign_id).with_for_update().populate_existing().one()
    donation = db.query(Donation).filter_by(id=donation_id).with_for_update().populate_existing().one_or_none()
    if donation is None or donation.campaign.organizer_user_id != request.state.actor.id:
        raise HTTPException(404, "Donation not found in your workspace.")
    if donation.campaign.status != "closed" or donation.source != "paypal" or donation.status != "captured":
        raise HTTPException(409, "Only captured PayPal donations in a cancelled campaign can be refunded here.")
    if donation.refund_processed:
        return DonationOut.model_validate(donation)
    confirmed_refund = db.query(PaymentAdjustment).filter_by(reference=f"capture:{donation.paypal_capture_id}").first() if donation.paypal_capture_id else None
    if confirmed_refund and confirmed_refund.status == "completed" and confirmed_refund.amount >= donation.amount:
        donation.refund_processed = True
        db.commit()
        return DonationOut.model_validate(donation)
    if not donation.paypal_capture_id:
        try:
            order = await paypal.get_order(donation.paypal_order_id)
            capture = order["purchase_units"][0]["payments"]["captures"][0]
            if (order.get("id") != donation.paypal_order_id
                    or Decimal(capture["amount"]["value"]) != Decimal(str(donation.amount))
                    or capture["amount"]["currency_code"] != donation.currency):
                raise ValueError("Order mismatch")
            donation.paypal_capture_id = capture["id"]
        except (PayPalError, KeyError, IndexError, TypeError, ValueError, ArithmeticError) as exc:
            raise HTTPException(503, "Could not confirm the PayPal capture ID for this donation.") from exc
    if not donation.refund_request_id:
        previous = db.query(PaymentAdjustment).filter_by(reference=f"capture:{donation.paypal_capture_id}").first()
        donation.refund_start_amount = previous.amount if previous and previous.status == "completed" else 0.0
        donation.refund_request_id = f"straightmoney-refund-{donation.id}-{uuid.uuid4().hex}"
    db.commit()  # Persist the idempotency key and release locks before the PayPal call.
    try:
        result = await paypal.refund_capture(donation.paypal_capture_id, donation.refund_request_id)
        if not result.get("amount") and result.get("id"):
            result = await paypal.get_refund(result["id"])
    except PayPalError as exc:
        raise HTTPException(503, "PayPal refund status is uncertain. Retry to reuse the same request ID.") from exc
    amount = result.get("amount") or {}
    try:
        refund_amount = Decimal(str(amount["value"]))
    except (KeyError, ValueError, ArithmeticError, TypeError) as exc:
        raise HTTPException(502, "PayPal returned an incomplete refund amount; review its status before retrying.") from exc
    if (result.get("status") not in {"COMPLETED", "PENDING"} or amount.get("currency_code") != donation.currency
            or not refund_amount.is_finite() or refund_amount <= 0):
        raise HTTPException(502, "PayPal did not confirm a matching refund. Review its status before retrying.")
    total = Decimal(str(donation.refund_start_amount)) + refund_amount
    if result["status"] == "COMPLETED":
        row = record_refund_total(db, donation, total, "completed", f"capture:{donation.paypal_capture_id}")
        db.query(PaymentAdjustment).filter_by(reference=f"refund-request:{donation.id}").delete()
        donation.refund_processed = True
        db.commit()
    else:
        row = record_refund_request(db, donation, refund_amount, "pending")
    audit.log(db, actor=f"organizer:{request.state.actor.email}", action="donation.refund_requested",
              campaign_id=donation.campaign_id, detail={"donation_id": donation.id, "refund_id": result.get("id"),
                                                      "status": row.status})
    db.refresh(donation)
    return DonationOut.model_validate(donation)


# ---------------------------------------------------------------------------
# Endpoint 4 â€” Create donation (PayPal order)
# ---------------------------------------------------------------------------


@router.post("/campaigns/{campaign_id}/donate", response_model=DonationCreateOut, status_code=201)
@router.post("/campaigns/{campaign_id}/donations", response_model=DonationCreateOut, status_code=201)
async def create_donation(
    campaign_id: int,
    payload: DonationCreate,
    db: Session = Depends(get_db),
):
    """
    Initiate a PayPal order for a campaign donation.

    The frontend redirects the donor to ``approval_url``, then calls the
    capture endpoint after PayPal returns the approved order ID.
    """
    campaign = _get_or_404(db, Campaign, campaign_id)
    if campaign.status != "active":
        raise HTTPException(status_code=400, detail="Donations are only accepted for active campaigns.")

    if payload.simulate and not settings.allow_simulated_donations:
        raise HTTPException(status_code=403, detail="Simulated donations are disabled.")

    if payload.simulate:
        order_id = f"SANDBOX-SIM-ORDER-{uuid.uuid4().hex[:10].upper()}"
        is_simulated = True
        approval_url = None
    else:
        if not paypal.is_configured:
            raise HTTPException(status_code=503, detail="PayPal Sandbox checkout is not configured.")
        try:
            order = await paypal.create_order(
                campaign_id=campaign_id,
                amount=payload.amount,
                currency=campaign.currency,
                donor_name=payload.donor_name,
            )
            order_id = order["id"]
            approval_url = next((link.get("href") for link in order.get("links", [])
                                 if link.get("rel") in {"approve", "payer-action"}), None)
            parsed = urlparse(approval_url or "")
            if (parsed.scheme != "https" or parsed.hostname not in {"www.sandbox.paypal.com", "sandbox.paypal.com"}
                    or not parsed.path or not parsed.query):
                raise HTTPException(502, "PayPal did not return a valid Sandbox checkout link. No donation was created.")
            is_simulated = False
        except PayPalError as exc:
            raise HTTPException(status_code=502, detail=f"PayPal error: {exc.body}")

    donation = Donation(
        campaign_id=campaign_id,
        donor_name=payload.donor_name,
        amount=payload.amount,
        currency=campaign.currency,
        paypal_order_id=order_id,
        source="simulated" if is_simulated else "paypal",
        status="created",
    )
    db.add(donation)
    db.commit()
    db.refresh(donation)
    audit.log(
        db,
        actor=payload.donor_name,
        action="donation.created",
        campaign_id=campaign_id,
        detail={"paypal_order_id": order_id, "amount": payload.amount, "simulated": is_simulated},
    )
    return DonationCreateOut(**DonationOut.model_validate(donation).model_dump(), approval_url=approval_url)


# ---------------------------------------------------------------------------
# Endpoint 5 â€” Capture donation
# ---------------------------------------------------------------------------


def _paypal_capture_status(capture_data: dict) -> str:
    """Use the payment capture status, not the enclosing order status."""
    try:
        value = capture_data["purchase_units"][0]["payments"]["captures"][0]["status"]
        return value if isinstance(value, str) and value else "UNKNOWN"
    except (KeyError, IndexError, TypeError):
        return "UNKNOWN"


def _store_capture_result(db: Session, order_id: str, capture_data: dict) -> tuple[Donation, Campaign | None, bool]:
    """Store the PayPal result and credit a completed capture once."""
    initial = db.query(Donation).filter_by(paypal_order_id=order_id).one()
    db.query(Campaign).filter_by(id=initial.campaign_id).with_for_update().populate_existing().one()
    donation = (db.query(Donation).filter_by(paypal_order_id=order_id)
                .with_for_update().populate_existing().one())
    if donation.status == "captured":
        if not donation.paypal_capture_id and not capture_data.get("simulated"):
            try:
                donation.paypal_capture_id = capture_data["purchase_units"][0]["payments"]["captures"][0]["id"]
                db.commit()
            except (KeyError, IndexError, TypeError):
                pass
        return donation, None, False

    capture_status = _paypal_capture_status(capture_data)
    donation.paypal_capture_status = capture_status
    campaign = None
    credited = capture_status == "COMPLETED"
    if credited and donation.source != "simulated":
        try:
            capture = capture_data["purchase_units"][0]["payments"]["captures"][0]
            amount = capture["amount"]
            if (Decimal(amount["value"]) != Decimal(str(donation.amount))
                    or amount["currency_code"] != donation.currency
                    or capture_data.get("id") != order_id
                    or capture_data.get("simulated")):
                raise ValueError("Capture does not match this donation.")
        except (KeyError, IndexError, TypeError, ValueError, ArithmeticError) as exc:
            db.rollback()
            raise HTTPException(502, "PayPal capture amount, currency or order did not match; no funds were credited.") from exc
    if credited:
        if not capture_data.get("simulated"):
            donation.paypal_capture_id = capture.get("id")
        campaign = (db.query(Campaign).filter_by(id=donation.campaign_id)
                    .with_for_update().populate_existing().one())
        campaign.pool_balance = round(campaign.pool_balance + donation.amount, 2)
        donation.status = "captured"
    else:
        donation.status = "pending" if capture_status in {"PENDING", "UNKNOWN"} else "failed"
    audit.log(
        db,
        actor=donation.donor_name,
        action=f"donation.{donation.status}",
        campaign_id=donation.campaign_id,
        commit=False,
        detail={"amount": donation.amount, "paypal_capture_status": donation.paypal_capture_status,
                "new_pool_balance": campaign.pool_balance if campaign else None},
    )
    db.commit()
    db.refresh(donation)
    return donation, campaign, credited


@router.post("/donations/{order_id}/capture", response_model=DonationCaptureOut)
async def capture_donation(order_id: str, db: Session = Depends(get_db)):
    """
    Capture an approved PayPal order and credit the campaign pool.

    ``order_id`` is the PayPal order ID (returned by the create-donation
    endpoint).  Call this after the donor has approved payment on PayPal.
    """
    donation = db.query(Donation).filter_by(paypal_order_id=order_id).first()
    if donation is None:
        raise HTTPException(status_code=404, detail=f"Donation with PayPal order '{order_id}' not found.")
    if donation.status == "captured":
        return DonationCaptureOut(
            **DonationOut.model_validate(donation).model_dump(),
            paypal_capture_details=None,
        )
    if donation.status == "failed":
        raise HTTPException(status_code=409, detail="Donation capture failed; create a new order.")

    if donation.source == "simulated":
        if not settings.allow_simulated_donations:
            raise HTTPException(status_code=403, detail="Simulated donations are disabled.")
        capture_data = {
            "id": order_id,
            "status": "COMPLETED",
            "purchase_units": [{"payments": {"captures": [{"status": "COMPLETED"}]}}],
            "simulated": True,
        }
    else:
        if not paypal.is_configured:
            raise HTTPException(status_code=503, detail="PayPal Sandbox checkout is not configured.")
        try:
            capture_data = await paypal.get_order(order_id)
            if capture_data.get("status") == "APPROVED" and _paypal_capture_status(capture_data) == "UNKNOWN":
                capture_data = await paypal.capture_order(order_id)
        except PayPalError as exc:
            body_str = json.dumps(exc.body) if isinstance(exc.body, (dict, list)) else str(exc.body)
            if "ORDER_ALREADY_CAPTURED" in body_str:
                try:
                    capture_data = await paypal.get_order(order_id)
                except PayPalError as error:
                    raise HTTPException(502, "Unable to reconcile PayPal capture; check status before donating again.") from error
            elif "ORDER_NOT_APPROVED" in body_str:
                await asyncio.sleep(1.0)
                try:
                    capture_data = await paypal.capture_order(order_id)
                except PayPalError:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "PayPal order was not approved. Complete checkout on the PayPal Sandbox page "
                            "with a Sandbox buyer account, then return to check its status."
                        ),
                    )
            else:
                raise HTTPException(status_code=502, detail=f"PayPal error: {exc.body}")

    donation, campaign, credited = _store_capture_result(db, order_id, capture_data)
    if credited and campaign and donation.source != "simulated":
        try:
            await asyncio.wait_for(pay_campaign(db, campaign.id, paypal), timeout=_PAYOUT_WAIT_SECONDS)
        except (TimeoutError, PayPalError):
            db.rollback()
            # The donation is already committed. A vendor status check can resume the queue.
            audit.log(db, actor="system", action="payout.queue_deferred", campaign_id=campaign.id)
    return DonationCaptureOut(
        **DonationOut.model_validate(donation).model_dump(),
        paypal_capture_details=capture_data,
    )


@router.get("/donations/{order_id}/status")
def donation_status(order_id: str, db: Session = Depends(get_db)):
    donation = db.query(Donation).filter_by(paypal_order_id=order_id).first()
    if donation is None:
        raise HTTPException(404, "Donation not found.")
    return {**DonationOut.model_validate(donation).model_dump(),
            "adjustments": [{"kind": row.kind, "amount": row.amount, "status": row.status,
                             "detail": row.detail} for row in donation.adjustments]}


# ---------------------------------------------------------------------------
# Endpoint 6 â€” Submit invoice  (POST /invoices)
# ---------------------------------------------------------------------------


@router.post("/invoices", response_model=InvoiceDetail, status_code=201, dependencies=[Depends(require_vendor)])
async def submit_invoice(
    campaign_id: int = Form(...),
    budget_line_id: int = Form(...),
    invoice_number: str = Form(..., min_length=1, max_length=200),
    vendor_id: Optional[int] = Form(None),
    invoice_file: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    proof_photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Submit a vendor invoice for review.

    Accepts multipart/form-data with:
    - campaign_id, budget_line_id, invoice_number (required)
    - vendor_id (optional, derived from budget line if omitted)
    - invoice_file / file: the invoice or receipt (PDF/image)
    - proof_photo: optional photo verifying delivery/completion
    """
    campaign = _get_or_404(db, Campaign, campaign_id)
    budget_line = _get_or_404(db, BudgetLine, budget_line_id)
    if not invoice_number.strip():
        raise HTTPException(422, "Invoice number is required.")

    if vendor_id is None:
        vendor_id = budget_line.vendor_id
    if vendor_id is None:
        raise HTTPException(status_code=400, detail="Budget line has no assigned vendor.")

    vendor = _get_or_404(db, Vendor, vendor_id)
    if request is not None and vendor.user_id != request.state.actor.id:
        raise HTTPException(403, "This budget line is not assigned to your vendor account.")

    if budget_line.campaign_id != campaign_id:
        raise HTTPException(status_code=400, detail="Budget line does not belong to this campaign.")
    if vendor.campaign_id != campaign_id:
        raise HTTPException(status_code=400, detail="Vendor does not belong to this campaign.")
    if budget_line.vendor_id != vendor.id:
        raise HTTPException(status_code=403, detail="This vendor is not assigned to the budget line.")

    # --- Validate file ---
    actual_file = invoice_file or file
    if actual_file is None:
        raise HTTPException(status_code=400, detail="Please attach an invoice file (PDF or image).")

    invoice_bytes, content_type, ext = await read_upload(actual_file)
    proof_bytes = None
    proof_mime = None
    proof_ext = None
    if proof_photo and proof_photo.filename:
        proof_bytes, proof_mime, proof_ext = await read_upload(proof_photo, proof=True)

    temporary = tempfile.TemporaryDirectory(prefix="straightmoney-")
    abs_save_path = str(Path(temporary.name) / ("invoice" + ext))
    await run_in_threadpool(Path(abs_save_path).write_bytes, invoice_bytes)
    abs_proof_path = None
    if proof_bytes is not None:
        abs_proof_path = str(Path(temporary.name) / ("proof" + proof_ext))
        await run_in_threadpool(Path(abs_proof_path).write_bytes, proof_bytes)

    # --- Create initial Invoice row (SUBMITTED) ---
    db.query(Campaign).filter_by(id=campaign_id).with_for_update().populate_existing().one()
    invoice = Invoice(
        campaign_id=campaign_id,
        budget_line_id=budget_line_id,
        vendor_id=vendor_id,
        invoice_number=invoice_number.strip()[:200],
        document_hash=hashlib.sha256(invoice_bytes).hexdigest(),
        amount=0.0,
        currency=campaign.currency,
        payout_email=vendor.payout_email,
        raw_file_path=None,
        evidence_path=None,
        status="SUBMITTED",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    stored = StoredFile(invoice_id=invoice.id, kind="invoice", filename="invoice" + ext,
                        mime_type=content_type, data=invoice_bytes)
    db.add(stored)
    db.flush()
    invoice.raw_file_path = f"files/{stored.id}/{stored.filename}"
    if proof_bytes is not None:
        proof = StoredFile(invoice_id=invoice.id, kind="proof", filename="proof" + proof_ext,
                           mime_type=proof_mime, data=proof_bytes)
        db.add(proof)
        db.flush()
        invoice.evidence_path = f"files/{proof.id}/{proof.filename}"
    db.commit()
    audit.log(db, actor="system", action="invoice.submitted", campaign_id=campaign_id, invoice_id=invoice.id)

    # --- LLM Extraction ---
    try:
        extracted: ExtractionResult = await asyncio.wait_for(
            extraction_module.extract_invoice(abs_save_path, content_type), timeout=130
        )
    except Exception as exc:
        temporary.cleanup()
        invoice.status = "NEEDS_REVIEW"
        reason = str(exc) or "Invoice extraction timed out. Please try again shortly."
        invoice.ai_summary = f"Extraction failed: {reason}"
        db.commit()
        audit.log(
            db,
            actor="system",
            action="invoice.extraction_failed",
            invoice_id=invoice.id,
            detail=str(exc),
        )
        raise HTTPException(status_code=422, detail=f"Invoice extraction failed: {reason}")

    invoice.extracted_json = extracted.model_dump_json()
    invoice.invoice_number = extracted.invoice_number.strip()
    invoice.amount = extracted.amount
    invoice.currency = extracted.currency or campaign.currency
    invoice.payout_email = extracted.payout_email
    invoice.description = extracted.description
    invoice.status = "EXTRACTED"
    db.commit()
    audit.log(db, actor="system", action="invoice.extracted", invoice_id=invoice.id)

    # Serialize duplicate/commitment checks with approvals in this campaign.
    campaign = db.query(Campaign).filter_by(id=campaign_id).with_for_update().populate_existing().one()
    db.refresh(budget_line)
    # --- Policy checks ---
    invoice_data = {
        "document_hash": invoice.document_hash,
        "payout_email": invoice.payout_email,
        "invoice_number": invoice.invoice_number,
        "amount": invoice.amount,
        "currency": invoice.currency,
        "evidence_path": invoice.evidence_path,
        "proof_file_attached": bool(abs_proof_path and os.path.exists(abs_proof_path)),
    }
    existing_invoices = (
        db.query(Invoice)
        .filter(Invoice.campaign_id == campaign_id, Invoice.id < invoice.id)
        .all()
    )
    invoice_data["committed_amount"] = sum(
        max(0.0, other.amount - other.paid_amount)
        for other in existing_invoices
        if other.budget_line_id == budget_line_id and other.status in {
            "AWAITING_FUNDS", "PARTIALLY_PAID", "PAYOUT_PENDING", "FAILED"
        } and any(v.decision in {"approve", "test_override"} for v in other.verifications)
    )
    policy_results = run_policy_checks(invoice_data, campaign, budget_line, vendor, existing_invoices)

    for result in policy_results:
        check_row = Check(
            invoice_id=invoice.id,
            check_name=result.check_name,
            passed=result.passed,
            severity=result.severity,
            source=result.source,
            detail=result.detail,
        )
        db.add(check_row)

    invoice.status = "CHECKED"
    db.commit()
    audit.log(db, actor="system", action="invoice.checked", invoice_id=invoice.id)

    any_hard_fail = any(not r.passed and r.severity == "hard" for r in policy_results)

    # --- Advisory checks (soft, non-blocking) ---
    try:
        advisory_result: AdvisoryResult = await asyncio.wait_for(advisory_module.run_advisory_checks(
            extracted=extracted,
            budget_line_name=budget_line.name,
            evidence_path=abs_proof_path or abs_save_path,
        ), timeout=25)
        summary_parts = [advisory_result.summary]
        if advisory_result.flags:
            summary_parts.append("Advisory flags: " + "; ".join(advisory_result.flags))
        invoice.ai_summary = "\n".join(summary_parts)
    except TimeoutError:
        invoice.ai_summary = "AI advisory timed out. Review the invoice and proof manually; payout checks are unaffected."
    except Exception as exc:
        invoice.ai_summary = f"Advisory checks could not be completed: {exc}"

    temporary.cleanup()

    # --- Determine final status ---
    if any_hard_fail:
        invoice.status = "REJECTED"
        audit.log(
            db,
            actor="system",
            action="invoice.rejected",
            invoice_id=invoice.id,
            detail={"hard_failures": [r.check_name for r in policy_results if not r.passed]},
        )
    else:
        invoice.status = "AWAITING_VERIFIER"
        audit.log(db, actor="system", action="invoice.awaiting_verifier", invoice_id=invoice.id)

    db.commit()
    db.refresh(invoice)
    return _invoice_to_detail(invoice)


# ---------------------------------------------------------------------------
# Endpoint 7 â€” Get invoice detail
# ---------------------------------------------------------------------------


@router.get("/invoices", response_model=list[InvoiceDetail])
def list_all_invoices(
    campaign_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List invoices, optionally filtered by campaign_id and status."""
    query = db.query(Invoice)
    if campaign_id is not None:
        query = query.filter(Invoice.campaign_id == campaign_id)
    if status:
        query = query.filter(Invoice.status == status)
    invoices = query.order_by(Invoice.created_at.desc()).all()
    return [_invoice_to_detail(inv) for inv in invoices]


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Retrieve full invoice detail including checks, verifications, and payout."""
    invoice = _get_or_404(db, Invoice, invoice_id)
    return _invoice_to_detail(invoice)


# ---------------------------------------------------------------------------
# Endpoint 8 â€” List invoices for a campaign
# ---------------------------------------------------------------------------


@router.get("/campaigns/{campaign_id}/invoices", response_model=list[InvoiceOut])
def list_invoices(campaign_id: int, db: Session = Depends(get_db)):
    """Return all invoices for a given campaign."""
    campaign = _get_or_404(db, Campaign, campaign_id)
    invoices = (
        db.query(Invoice)
        .filter_by(campaign_id=campaign_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    return [InvoiceOut.model_validate(inv) for inv in invoices]


@router.post("/invoices/{invoice_id}/delivery", response_model=DeliveryCloseoutOut, dependencies=[Depends(require_vendor)])
def report_delivery(invoice_id: int, payload: DeliveryReport, request: Request, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter_by(id=invoice_id).with_for_update().one_or_none()
    if invoice is None or invoice.vendor.user_id != request.state.actor.id:
        raise HTTPException(404, "Invoice not found in your assignments.")
    if invoice.status != "PAID":
        raise HTTPException(409, "Delivery closeout is available after full payout.")
    if payload.delivered_at.replace(tzinfo=None) > datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(422, "Delivery date cannot be in the future.")
    if invoice.delivery and invoice.delivery.accepted_at:
        raise HTTPException(409, "Accepted delivery cannot be changed by the vendor.")
    closeout = invoice.delivery or DeliveryCloseout(invoice_id=invoice.id, reported_by_user_id=request.state.actor.id)
    closeout.delivered_description = payload.delivered_description
    closeout.delivered_at = payload.delivered_at.replace(tzinfo=None)
    closeout.status = "reported"
    db.add(closeout)
    audit.log(db, actor=f"vendor:{request.state.actor.email}", action="delivery.reported",
              campaign_id=invoice.campaign_id, invoice_id=invoice.id,
              detail={"delivered_description": payload.delivered_description}, commit=False)
    db.commit()
    db.refresh(closeout)
    return DeliveryCloseoutOut.model_validate(closeout)


@router.post("/invoices/{invoice_id}/delivery/accept", response_model=DeliveryCloseoutOut, dependencies=[Depends(require_organizer)])
def accept_delivery(invoice_id: int, payload: DeliveryAcceptance, request: Request, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter_by(id=invoice_id).with_for_update().one_or_none()
    if invoice is None or invoice.campaign.organizer_user_id != request.state.actor.id:
        raise HTTPException(404, "Invoice not found in your campaign.")
    closeout = invoice.delivery
    if invoice.status != "PAID" or closeout is None:
        raise HTTPException(409, "A paid invoice needs a vendor delivery report before acceptance.")
    if closeout.accepted_at:
        raise HTTPException(409, "Delivery was already accepted.")
    closeout.accepted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    closeout.accepted_by_user_id = request.state.actor.id
    closeout.remaining_issue = payload.remaining_issue.strip() if payload.remaining_issue else None
    closeout.status = "issues_open" if closeout.remaining_issue else "accepted"
    audit.log(db, actor=f"organizer:{request.state.actor.email}", action="delivery.accepted",
              campaign_id=invoice.campaign_id, invoice_id=invoice.id,
              detail={"remaining_issue": closeout.remaining_issue}, commit=False)
    db.commit()
    db.refresh(closeout)
    return DeliveryCloseoutOut.model_validate(closeout)


# ---------------------------------------------------------------------------
# Endpoint 9 â€” Approve invoice (human verifier)
# ---------------------------------------------------------------------------


def _record_payout_result(invoice, payout, campaign, budget_line, response):
    """Credit accounting only after the recipient transaction succeeds."""
    if response.get("simulated") or (response.get("batch_header", {}).get("payout_batch_id") or payout.paypal_batch_id or "").startswith("SANDBOX-"):
        raise PayPalError(409, {"error": "Payout was simulated; no money was sent. Configure an enabled sandbox payout account."})
    header = response.get("batch_header", {})
    payout.paypal_batch_id = header.get("payout_batch_id") or payout.paypal_batch_id
    payout.sender_batch_id = header.get("sender_batch_header", {}).get("sender_batch_id") or payout.sender_batch_id
    items = response.get("items", [])
    succeeded = bool(items) and all(item.get("transaction_status") == "SUCCESS" for item in items)
    failed = header.get("batch_status") in {"DENIED", "CANCELED"} or any(
        item.get("transaction_status") in {"FAILED", "BLOCKED", "RETURNED", "REFUNDED"} for item in items
    )
    if succeeded and payout.status != "success":
        campaign.pool_balance -= invoice.amount
        budget_line.paid_amount += invoice.amount
    payout.status = "success" if succeeded else "failed" if failed else "pending"
    invoice.status = "PAID" if succeeded else "FAILED" if failed else "PAYOUT_PENDING"


_PAYOUT_WAIT_SECONDS = 40


async def _pay_with_deadline(db: Session, invoice: Invoice) -> None:
    """Return the verifier request even if PayPal does not answer promptly."""
    try:
        await asyncio.wait_for(pay_available(db, invoice, paypal), timeout=_PAYOUT_WAIT_SECONDS)
    except TimeoutError:
        db.rollback()
        audit.log(db, actor="system", action="payout.response_timeout",
                  campaign_id=invoice.campaign_id, invoice_id=invoice.id,
                  detail="PayPal response timed out; check the existing installment before retrying.")
        db.expire_all()


@router.post("/invoices/{invoice_id}/approve", response_model=InvoiceDetail, dependencies=[Depends(require_verifier)])
async def approve_invoice(
    invoice_id: int,
    payload: VerificationCreate,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Approve an invoice as a human verifier and trigger the vendor payout.

    Only invoices in AWAITING_VERIFIER status can be approved.
    Triggers a PayPal payout; status progresses to PAYOUT_PENDING then PAID
    (or FAILED if PayPal returns an error).
    """
    invoice = _locked_invoice(db, invoice_id)
    if request is not None and (invoice.campaign.organizer_user_id == request.state.actor.id or invoice.vendor.user_id == request.state.actor.id):
        raise HTTPException(403, "A campaign participant cannot verify this invoice.")
    if payload.override_for_testing:
        if not settings.enable_verifier_test_override or settings.paypal_base_url.rstrip("/") != "https://api-m.sandbox.paypal.com":
            raise HTTPException(status_code=403, detail="Verifier test override is available only in PayPal Sandbox when enabled.")
        if invoice.status not in {"REJECTED", "AWAITING_VERIFIER", "NEEDS_REVIEW"}:
            raise HTTPException(status_code=409, detail="Only an unpaid, unapproved invoice can use the test override.")
        campaign = _get_or_404(db, Campaign, invoice.campaign_id)
        budget_line = _get_or_404(db, BudgetLine, invoice.budget_line_id)
        vendor = _get_or_404(db, Vendor, invoice.vendor_id)
        if budget_line.campaign_id != campaign.id or vendor.campaign_id != campaign.id:
            raise HTTPException(status_code=409, detail="Invoice vendor and budget line must belong to this campaign.")
        if not math.isfinite(invoice.amount) or invoice.amount <= 0:
            raise HTTPException(status_code=409, detail="A positive invoice amount is required to test a payout.")
        original_email = invoice.payout_email
        invoice.payout_email = vendor.payout_email
        invoice.currency = campaign.currency
        audit.log(db, actor=f"verifier:{request.state.actor.name if request is not None else payload.verifier_name}", action="invoice.sandbox_test_override",
                  campaign_id=invoice.campaign_id, invoice_id=invoice.id,
                  detail={"reason": payload.note or "Sandbox payout test",
                          "bypassed_checks": [c.check_name for c in invoice.checks if not c.passed],
                          "invoice_payout_email": original_email,
                          "registered_vendor_email": vendor.payout_email}, commit=False)
    else:
        _guard_invoice_status(invoice, "AWAITING_VERIFIER")
        _recheck_approval(db, invoice)

    # Record verification decision
    verification = Verification(
        invoice_id=invoice_id,
        verifier_name=request.state.actor.name if request is not None else payload.verifier_name,
        decision="test_override" if payload.override_for_testing else "approve",
        note=payload.note or ("Sandbox payout test" if payload.override_for_testing else None),
    )
    db.add(verification)
    audit.log(
        db,
        actor=f"verifier:{request.state.actor.name if request is not None else payload.verifier_name}",
        action="invoice.approved",
        campaign_id=invoice.campaign_id,
        invoice_id=invoice_id,
        commit=False,
    )

    # Retrieve dependencies for payout
    vendor = db.get(Vendor, invoice.vendor_id)
    campaign = db.get(Campaign, invoice.campaign_id)
    budget_line = db.get(BudgetLine, invoice.budget_line_id)

    if vendor is None or campaign is None or budget_line is None:
        raise HTTPException(status_code=500, detail="Data integrity error: related records missing.")

    invoice.status = "AWAITING_FUNDS"
    db.commit()
    await _pay_with_deadline(db, invoice)

    db.refresh(invoice)
    return _invoice_to_detail(invoice)


# ---------------------------------------------------------------------------
# Endpoint 10 â€” Reject invoice (human verifier)
# ---------------------------------------------------------------------------


@router.post("/invoices/{invoice_id}/reject", response_model=InvoiceDetail, dependencies=[Depends(require_verifier)])
def reject_invoice(
    invoice_id: int,
    payload: VerificationCreate,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Reject an invoice as a human verifier.

    Only invoices in AWAITING_VERIFIER status can be rejected this way.
    """
    invoice = _locked_invoice(db, invoice_id)
    if request is not None and (invoice.campaign.organizer_user_id == request.state.actor.id or invoice.vendor.user_id == request.state.actor.id):
        raise HTTPException(403, "A campaign participant cannot verify this invoice.")
    _guard_invoice_status(invoice, "AWAITING_VERIFIER")

    verification = Verification(
        invoice_id=invoice_id,
        verifier_name=request.state.actor.name if request is not None else payload.verifier_name,
        decision="reject",
        note=payload.note,
    )
    db.add(verification)
    invoice.status = "VERIFIER_REJECTED"
    audit.log(
        db,
        actor=f"verifier:{request.state.actor.name if request is not None else payload.verifier_name}",
        action="invoice.verifier_rejected",
        invoice_id=invoice_id,
        commit=False,
        detail={"note": payload.note},
    )
    db.commit()
    db.refresh(invoice)
    return _invoice_to_detail(invoice)


# ---------------------------------------------------------------------------
# Endpoint 11 â€” Retry failed invoice
# ---------------------------------------------------------------------------


@router.post("/invoices/{invoice_id}/retry", response_model=InvoiceDetail, dependencies=[Depends(require_verifier)])
async def retry_invoice(
    invoice_id: int,
    payload: VerificationCreate,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Retry a payout for an invoice in FAILED status.

    Checks payout status first; if not already in a terminal success state,
    re-triggers the PayPal payout.
    """
    invoice = _locked_invoice(db, invoice_id)
    if request is not None and (invoice.campaign.organizer_user_id == request.state.actor.id or invoice.vendor.user_id == request.state.actor.id):
        raise HTTPException(403, "A campaign participant cannot verify this invoice.")
    if invoice.status not in {"FAILED", "PAYOUT_PENDING", "PARTIALLY_PAID", "AWAITING_FUNDS"}:
        raise HTTPException(status_code=409, detail="Only failed or pending payouts can be checked or retried.")

    vendor = db.get(Vendor, invoice.vendor_id)
    campaign = db.get(Campaign, invoice.campaign_id)
    budget_line = db.get(BudgetLine, invoice.budget_line_id)

    if vendor is None or campaign is None or budget_line is None:
        raise HTTPException(status_code=500, detail="Data integrity error: related records missing.")

    # Reconcile the existing transfer before attempting another installment.
    if invoice.installments:
        invoice.status = "PARTIALLY_PAID" if invoice.paid_amount > 0 else "AWAITING_FUNDS"
        db.commit()
        await _pay_with_deadline(db, invoice)
    else:
        raise HTTPException(status_code=409, detail="This legacy payout requires manual PayPal reconciliation.")

    db.refresh(invoice)
    return _invoice_to_detail(invoice)


# ---------------------------------------------------------------------------
# Endpoint 12 â€” Public ledger
# ---------------------------------------------------------------------------


@router.get("/campaigns/{campaign_id}/ledger", response_model=list[LedgerEntry])
def get_ledger(campaign_id: int, db: Session = Depends(get_db)):
    """
    Return the public transparency ledger for a campaign.

    Combines all captured donations and completed payouts in chronological
    order so that donors can see exactly how their money was spent.
    """
    campaign = _get_or_404(db, Campaign, campaign_id)

    entries: list[LedgerEntry] = []

    # Donations
    donations = db.query(Donation).filter_by(campaign_id=campaign_id).all()
    for d in donations:
        entries.append(
            LedgerEntry(
                type="donation",
                amount=d.amount,
                actor_name=d.donor_name,
                status=d.status,
                source=d.source,
                created_at=d.created_at,
                proof_url=None,
                donation_id=d.id,
            )
        )

    if campaign.cancelled_at:
        entries.append(LedgerEntry(type="campaign", amount=0, actor_name=campaign.organizer_name,
            status="cancelled", created_at=campaign.cancelled_at, proof_url=None,
            detail=campaign.cancellation_reason))

    for donation in donations:
        refund = next((row for row in donation.adjustments if row.kind == "refund" and row.status == "completed"), None)
        refunded = min(donation.amount, refund.amount) if refund else 0.0
        remaining_available = max(donation.amount - refunded, 0.0)
        for row in sorted(donation.adjustments, key=lambda item: item.id):
            if row.kind == "refund":
                amount = -refunded if row.status == "completed" else 0.0
            else:
                amount = -min(remaining_available, row.amount) if row.status in {"open", "buyer_favor"} else 0.0
                remaining_available += amount
            entries.append(LedgerEntry(type=row.kind, amount=amount, actor_name=donation.donor_name,
                status=row.status, source="paypal", created_at=row.updated_at or row.created_at,
                proof_url=None, detail=row.detail, donation_id=donation.id))

    # One ledger entry per confirmed installment; include earlier single payouts.
    invoices = db.query(Invoice).filter_by(campaign_id=campaign_id).all()
    for inv in invoices:
        proof_url = f"/{inv.evidence_path.lstrip(chr(47))}" if inv.evidence_path else None
        vendor = db.get(Vendor, inv.vendor_id)
        if inv.payout and inv.payout.status == "success":
            entries.append(LedgerEntry(type="payout", amount=inv.payout.amount,
                actor_name=vendor.name if vendor else "Unknown Vendor", status="success",
                created_at=inv.payout.created_at, proof_url=proof_url, invoice_id=inv.id))
        for part in inv.installments:
            if part.status == "success":
                entries.append(LedgerEntry(type="payout", amount=part.amount,
                    actor_name=vendor.name if vendor else "Unknown Vendor", status="success",
                    created_at=part.created_at, proof_url=proof_url, invoice_id=inv.id))
        if inv.delivery:
            closeout = inv.delivery
            entries.append(LedgerEntry(type="delivery", amount=0,
                actor_name=vendor.name if vendor else "Unknown Vendor", status=closeout.status,
                created_at=closeout.accepted_at or closeout.created_at, proof_url=proof_url,
                invoice_id=inv.id,
                detail=f"{closeout.delivered_description} Delivered {closeout.delivered_at.date().isoformat()}."
                       + (f" Remaining issue: {closeout.remaining_issue}" if closeout.remaining_issue else "")))

    # Sort chronologically
    entries.sort(key=lambda e: e.created_at)
    return entries


@router.get("/donations/{order_id}/updates")
def donor_updates(order_id: str, db: Session = Depends(get_db)):
    """Return saved campaign milestones to a donor holding their order ID."""
    donation = db.query(Donation).filter_by(paypal_order_id=order_id).first()
    if donation is None:
        raise HTTPException(404, "Donation not found.")
    if donation.status != "captured":
        return []
    campaign = db.get(Campaign, donation.campaign_id)
    actions = {"invoice.approved", "payout.success", "delivery.accepted"}
    invoice_ids = [invoice_id for (invoice_id,) in db.query(Invoice.id).filter_by(campaign_id=donation.campaign_id).all()]
    rows = db.query(AuditLog).filter(AuditLog.action.in_(actions),
        AuditLog.timestamp >= donation.created_at,
        or_(AuditLog.campaign_id == donation.campaign_id, AuditLog.invoice_id.in_(invoice_ids))).order_by(AuditLog.id).all()
    last_success_id: dict[int, int] = {}
    for row in rows:
        if row.action == "payout.success" and row.invoice_id is not None:
            last_success_id[row.invoice_id] = row.id
    updates = []
    for row in rows:
        invoice = db.get(Invoice, row.invoice_id) if row.invoice_id else None
        if invoice is None or invoice.campaign_id != donation.campaign_id:
            continue
        if row.action == "payout.success":
            try:
                recorded_status = json.loads(row.detail or "{}").get("invoice_status")
            except (ValueError, TypeError, AttributeError):
                recorded_status = None
            if recorded_status != "PAID" and not (
                recorded_status is None and invoice.status == "PAID" and row.id == last_success_id.get(invoice.id)
            ):
                continue
        line_name = invoice.budget_line.name
        if row.action == "invoice.approved":
            kind, title = "approved", f"{line_name} approved"
            message = "An independent verifier approved the invoice for this budget line. Payment may still await available funds."
        elif row.action == "payout.success":
            kind, title = "paid", f"{line_name} paid"
            message = "The vendor payout for this invoice was confirmed by PayPal."
        else:
            kind, title = "delivered", f"{line_name} delivery accepted"
            issue = invoice.delivery.remaining_issue if invoice.delivery else None
            message = f"The organizer accepted the delivered work. Remaining issue: {issue}" if issue else "The organizer accepted the delivered work."
        updates.append({"id": row.id, "campaign_id": campaign.id, "campaign_title": campaign.title,
                        "budget_line_id": invoice.budget_line_id, "kind": kind, "title": title,
                        "message": message, "created_at": row.timestamp.isoformat() + "Z",
                        "proof_url": f"/{invoice.evidence_path.lstrip('/')}" if invoice.evidence_path else None})
    return updates


def _csv_cell(value: object) -> object:
    """Keep untrusted names and notes from becoming spreadsheet formulas."""
    if not isinstance(value, str):
        return value
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value


@router.get("/campaigns/{campaign_id}/report.csv")
def campaign_report(campaign_id: int, request: Request, db: Session = Depends(get_db)):
    """Download the public transaction and delivery record with evidence URLs."""
    campaign = _get_or_404(db, Campaign, campaign_id)
    entries = get_ledger(campaign_id, db)
    invoices = {invoice.id: invoice for invoice in db.query(Invoice).filter_by(campaign_id=campaign_id).all()}
    base_url = str(request.base_url).rstrip("/")
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["campaign_id", "campaign_title", "campaign_status", "cancellation_reason", "currency",
                     "goal_amount", "available_balance", "entry_date_utc", "entry_type", "actor", "amount",
                     "status", "detail", "invoice_url", "delivery_proof_url"])
    for entry in entries:
        invoice = invoices.get(entry.invoice_id)
        invoice_url = f"{base_url}/{invoice.raw_file_path.lstrip('/')}" if invoice and invoice.raw_file_path else ""
        proof_url = f"{base_url}{entry.proof_url}" if entry.proof_url else ""
        values = [campaign.id, campaign.title, campaign.status, campaign.cancellation_reason or "",
                  campaign.currency, campaign.goal_amount, campaign.pool_balance,
                  entry.created_at.isoformat() + "Z", entry.type, entry.actor_name,
                  entry.amount, entry.status, entry.detail or "", invoice_url, proof_url]
        writer.writerow([_csv_cell(value) for value in values])
    return Response(content="\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="campaign-{campaign_id}-report.csv"',
                             "Cache-Control": "no-store"})


@router.post("/campaigns/{campaign_id}/ledger/ask", response_model=LedgerAnswer)
async def ask_ledger(campaign_id: int, payload: LedgerQuestion, db: Session = Depends(get_db)):
    """Answer a question from this campaign's current public ledger only."""
    campaign = _get_or_404(db, Campaign, campaign_id)
    entries = get_ledger(campaign_id, db)
    if len(entries) > 500:
        raise HTTPException(413, "This ledger is too large for the question tool.")
    snapshot = [entry.model_dump(mode="json", exclude={"proof_url"}) for entry in entries]
    try:
        answer = await asyncio.wait_for(
            advisory_module.answer_ledger_question(payload.question, snapshot, campaign.currency),
            timeout=25,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(504, "Ledger answers are taking too long. Please try again.") from exc
    except Exception as exc:
        raise HTTPException(503, "Ledger answers are unavailable right now. Please try again later.") from exc
    return LedgerAnswer(answer=answer)


@router.post("/webhooks/paypal")
async def paypal_webhook(request: Request, db: Session = Depends(get_db)):
    """Verify a PayPal event, then reconcile against PayPal's current state."""
    try:
        event = await request.json()
    except ValueError as exc:
        raise HTTPException(400, "Invalid webhook JSON.") from exc
    if not isinstance(event, dict):
        raise HTTPException(400, "Invalid webhook event.")
    try:
        verified = await paypal.verify_webhook_signature(dict(request.headers), event)
    except PayPalError as exc:
        raise HTTPException(503, "PayPal webhook verification is unavailable.") from exc
    if not verified:
        raise HTTPException(401, "Invalid PayPal webhook signature.")
    try:
        result = await process_webhook(db, event, paypal)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except PayPalError as exc:
        db.rollback()
        raise HTTPException(503, "PayPal reconciliation is temporarily unavailable.") from exc
    return {"status": result}


# ---------------------------------------------------------------------------
# Mount routes under both root / and /api prefix
# ---------------------------------------------------------------------------
app.include_router(router)
app.include_router(router, prefix="/api")
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")

