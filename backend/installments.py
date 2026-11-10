"""Pay approved invoices in tracked installments as campaign funds arrive."""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import BudgetLine, Campaign, Donation, Invoice, PayoutInstallment, Vendor
import math
import uuid
import audit
from payments import PayPalClient, PayPalError


def paid_amount(invoice: Invoice) -> float:
    legacy = invoice.payout.amount if invoice.payout and invoice.payout.status == "success" else 0.0
    return round(legacy + sum(part.amount for part in invoice.installments if part.status == "success"), 2)


def _status(invoice: Invoice) -> str:
    paid = paid_amount(invoice)
    if paid >= invoice.amount - 0.005:
        return "PAID"
    return "PARTIALLY_PAID" if paid > 0 else "AWAITING_FUNDS"


def _apply_status(db: Session, part: PayoutInstallment, response: dict) -> None:
    campaign_id = part.invoice.campaign_id
    campaign = db.query(Campaign).filter_by(id=campaign_id).with_for_update().populate_existing().one()
    invoice = db.query(Invoice).filter_by(id=part.invoice_id).with_for_update().populate_existing().one()
    part = db.query(PayoutInstallment).filter_by(id=part.id).with_for_update().populate_existing().one()
    line = db.query(BudgetLine).filter_by(id=invoice.budget_line_id).with_for_update().populate_existing().one()
    db.expire(invoice, ["installments", "payout"])
    if part.status in {"success", "failed"}:
        db.commit()
        return
    if response.get("simulated") or (part.paypal_batch_id or "").startswith("SANDBOX-"):
        part.status = "failed"
        invoice.status = "FAILED"
        invoice.ai_summary = (invoice.ai_summary or "") + "\nPayout was simulated; no vendor received funds."
        audit.log(db, actor="system", action="payout.simulated", campaign_id=invoice.campaign_id,
                  invoice_id=invoice.id, detail={"installment_id": part.id}, commit=False)
        db.commit()
        return
    header = response.get("batch_header", {})
    part.paypal_batch_id = header.get("payout_batch_id") or part.paypal_batch_id
    items = response.get("items", [])
    succeeded = bool(items) and all(item.get("transaction_status") == "SUCCESS" for item in items)
    failed = header.get("batch_status") in {"DENIED", "CANCELED"} or any(
        item.get("transaction_status") in {"FAILED", "BLOCKED", "RETURNED", "REFUNDED"} for item in items
    )
    if succeeded and part.status != "success":
        campaign.pool_balance = round(campaign.pool_balance - part.amount, 2)
        line.paid_amount = round(line.paid_amount + part.amount, 2)
        part.status = "success"
        invoice.status = _status(invoice)
    elif failed:
        part.status = "failed"
        invoice.status = "FAILED"
    else:
        part.status = "pending"
        invoice.status = "PAYOUT_PENDING"
    audit.log(db, actor="system", action=f"payout.{part.status}", campaign_id=invoice.campaign_id,
              invoice_id=invoice.id, detail={"installment_id": part.id, "amount": part.amount,
                                             "paypal_batch_id": part.paypal_batch_id,
                                             "invoice_status": invoice.status}, commit=False)
    db.commit()


async def pay_available(db: Session, invoice: Invoice, paypal: PayPalClient) -> None:
    """Reconcile a pending transfer, then send at most the unreserved balance."""
    # Lock in the same order for allocation, reconciliation and approval.
    campaign = db.query(Campaign).filter_by(id=invoice.campaign_id).with_for_update().populate_existing().one()
    invoice = db.query(Invoice).filter_by(id=invoice.id).with_for_update().populate_existing().one()
    db.expire(invoice, ["installments", "verifications", "payout"])
    if invoice.status in {"MORE_EVIDENCE_REQUIRED", "ESCALATED", "SUBMITTED", "EXTRACTED", "CHECKED", "NEEDS_REVIEW", "AWAITING_VERIFIER"} or not any(v.decision == "approve" for v in invoice.verifications):
        db.commit()
        return
    pending = next((p for p in invoice.installments if p.status == "pending"), None)
    if pending:
        # The persisted reservation and key survive while the external request runs.
        db.commit()
        if pending.paypal_batch_id:
            try:
                result = await paypal.get_payout_status(pending.paypal_batch_id)
                _apply_status(db, pending, result)
            except PayPalError:
                return
        else:
            await _send_part(db, pending, paypal)
        if pending.status != "success":
            return
        await pay_available(db, invoice, paypal)
        return
    if invoice.status in {"FAILED", "PAID", "VERIFIER_REJECTED", "REJECTED"}:
        db.commit()
        return
    reserved = db.query(func.coalesce(func.sum(PayoutInstallment.amount), 0.0)).join(Invoice).filter(
        Invoice.campaign_id == campaign.id, PayoutInstallment.status == "pending"
    ).scalar()
    remaining = round(invoice.amount - paid_amount(invoice), 2)
    simulated = db.query(func.coalesce(func.sum(Donation.amount), 0.0)).filter(
        Donation.campaign_id == campaign.id, Donation.source == "simulated", Donation.status == "captured"
    ).scalar()
    available = round(campaign.pool_balance - float(simulated) - float(reserved), 2)
    amount = min(remaining, available)
    if amount < 0.01:
        invoice.status = _status(invoice)
        db.commit()
        return
    vendor = db.query(Vendor).filter_by(id=invoice.vendor_id).populate_existing().one_or_none()
    line = db.query(BudgetLine).filter_by(id=invoice.budget_line_id).populate_existing().one()
    if not math.isfinite(invoice.amount) or invoice.amount <= 0:
        invoice.status = "FAILED"
        db.commit()
        return
    if (vendor is None or vendor.status != "active" or vendor.payout_email.strip().casefold() != invoice.payout_email.strip().casefold()
            or vendor.campaign_id != campaign.id or line.campaign_id != campaign.id
            or campaign.status != "active" or line.vendor_id != vendor.id
            or invoice.currency != campaign.currency or amount > round(line.budgeted_amount - line.paid_amount, 2)):
        invoice.status = "FAILED"
        db.commit()
        return
    part = PayoutInstallment(invoice_id=invoice.id, amount=amount, currency=invoice.currency,
                             sender_batch_id=f"straightmoney-{uuid.uuid4().hex}")
    db.add(part)
    db.flush()
    invoice.status = "PAYOUT_PENDING"
    audit.log(db, actor="system", action="payout.installment_pending", campaign_id=invoice.campaign_id,
              invoice_id=invoice.id, detail={"installment_id": part.id, "amount": amount}, commit=False)
    db.commit()
    await _send_part(db, part, paypal)


async def _send_part(db: Session, part: PayoutInstallment, paypal: PayPalClient) -> None:
    invoice = part.invoice
    vendor = invoice.vendor
    try:
        result = await paypal.create_payout(invoice_id=invoice.id, installment_id=part.id,
            amount=part.amount, currency=invoice.currency, payout_email=invoice.payout_email, vendor_name=vendor.name, sender_batch_id=part.sender_batch_id)
        part.paypal_batch_id = result.get("batch_header", {}).get("payout_batch_id")
        _apply_status(db, part, result)
        if part.status == "pending" and part.paypal_batch_id:
            _apply_status(db, part, await paypal.get_payout_status(part.paypal_batch_id))
    except PayPalError as exc:
        db.rollback()
        db.query(Campaign).filter_by(id=invoice.campaign_id).with_for_update().populate_existing().one()
        invoice = db.query(Invoice).filter_by(id=invoice.id).with_for_update().populate_existing().one()
        part = db.query(PayoutInstallment).filter_by(id=part.id).with_for_update().populate_existing().one()
        if part.status in {"success", "failed"}:
            db.commit()
            return
        # A network error may follow an accepted request. Keep its idempotency key reserved.
        if part.paypal_batch_id or exc.status_code >= 500 or "DUPLICATE_BATCH_ID" in str(exc.body):
            part.status = "pending"
            invoice.status = "PAYOUT_PENDING"
            invoice.ai_summary = (invoice.ai_summary or "") + "\nPayout status uncertain; check PayPal before retrying."
        else:
            part.status = "failed"
            invoice.status = "FAILED"
            payout_unavailable = exc.status_code == 403 and isinstance(exc.body, dict) and exc.body.get("name") == "PAYOUT_NOT_AVAILABLE"
            message = (
                "PayPal Payouts are unavailable for this sandbox sender account's country. "
                "No funds were sent. Use a Payouts-enabled sandbox Business account "
                "from a supported sending country before retrying."
                if payout_unavailable else "Payout request was rejected by PayPal. Check account configuration before retrying."
            )
            invoice.ai_summary = (invoice.ai_summary or "") + f"\n{message}"
        audit.log(db, actor="system", action="payout.request_error", campaign_id=invoice.campaign_id,
                  invoice_id=invoice.id, detail={"installment_id": part.id, "error": str(exc)}, commit=False)
        db.commit()


async def pay_campaign(db: Session, campaign_id: int, paypal: PayPalClient) -> None:
    invoices = db.query(Invoice).filter(Invoice.campaign_id == campaign_id,
        Invoice.status.in_(["AWAITING_FUNDS", "PARTIALLY_PAID", "PAYOUT_PENDING"])).order_by(Invoice.id).all()
    for invoice in invoices:
        await pay_available(db, invoice, paypal)
