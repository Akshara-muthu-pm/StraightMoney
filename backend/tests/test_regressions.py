"""Regression coverage for payment integrity and untrusted upload boundaries."""
from io import BytesIO
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock
import time

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import main
from config import settings
from db import Base, get_db
from models import BudgetLine, Campaign, Donation, Invoice, StoredFile, Vendor, Verification
from models import User, UserSession
from auth import COOKIE_NAME, _digest, _now
from datetime import timedelta
from schemas import CampaignCreate, DonationCreate, ExtractionResult, VerificationCreate
from installments import _apply_status, pay_available
from payments import PayPalClient, PayPalError, load_env_credentials
from uploads import validate_content
from tests.test_installments import setup_invoice, FakePayPal
from tests.test_donation_capture import _donation, _response


def png():
    output = BytesIO()
    Image.new("RGB", (4, 4)).save(output, format="PNG")
    return output.getvalue()


@pytest.fixture(autouse=True)
def reset_rate_limits():
    from guards import _requests
    _requests.clear()
    yield
    _requests.clear()


@pytest.fixture
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        for user_id, role in ((1, "organizer"), (2, "vendor"), (3, "verifier")):
            db.add(User(id=user_id, email=f"{role}@example.com", name=role.title(), password_hash="fixture", role=role))
        db.flush()
        for user_id, role in ((1, "organizer"), (2, "vendor"), (3, "verifier")):
            db.add(UserSession(user_id=user_id, token_hash=_digest(f"fixture-{role}"),
                               expires_at=_now() + timedelta(days=1)))
        db.add(Campaign(id=1, title="Test", goal_amount=400, currency="USD", pool_balance=400,
                        status="active", organizer_name="Organizer", organizer_user_id=1))
        db.flush()
        db.add(Vendor(id=1, campaign_id=1, name="Vendor", payout_email="vendor@example.com", status="active", user_id=2))
        db.flush()
        db.add(BudgetLine(id=1, campaign_id=1, name="Books", vendor_id=1, budgeted_amount=400, paid_amount=0))
        db.commit()
    def override():
        with Session(engine) as db:
            yield db
    main.app.dependency_overrides[get_db] = override
    extracted = ExtractionResult(vendor_name="Vendor", payout_email="vendor@example.com",
        invoice_number="DOCUMENT-1", amount=400, currency="USD", description="Books")
    monkeypatch.setattr(main.extraction_module, "extract_invoice", AsyncMock(return_value=extracted))
    monkeypatch.setattr(main.advisory_module, "run_advisory_checks", AsyncMock(return_value=NS(flags=[], summary="Manual review required")))
    monkeypatch.setattr(settings, "verifier_key", "test-key")
    monkeypatch.setattr(main, "paypal", FakePayPal())
    browser = TestClient(main.app)
    browser.cookies.set(COOKIE_NAME, "fixture-vendor")
    yield browser, engine, extracted
    main.app.dependency_overrides.clear()
    engine.dispose()


def upload(client, number="FORM-NUMBER", proof=True):
    files = {"invoice_file": ("spoofed.html", png() + number.encode(), "application/pdf")}
    if proof:
        files["proof_photo"] = ("proof.html", png(), "text/html")
    return client.post("/invoices", data={"campaign_id":1,"budget_line_id":1,"invoice_number":number}, files=files)


def as_role(browser, role):
    browser.cookies.set(COOKIE_NAME, f"fixture-{role}")


def test_upload_uses_content_canonical_number_and_database_evidence(client):
    browser, engine, _ = client
    response = upload(browser)
    assert response.status_code == 201, response.text
    detail = response.json()
    assert detail["invoice_number"] == "DOCUMENT-1"
    assert detail["raw_file_path"].endswith("invoice.png")
    assert detail["evidence_path"].endswith("proof.png")
    served = browser.get("/" + detail["evidence_path"])
    assert served.content == png()
    assert served.headers["content-type"] == "image/png"
    assert served.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in served.headers["content-security-policy"]
    with Session(engine) as db:
        assert db.query(StoredFile).count() == 2
    duplicate = upload(browser, "DIFFERENT-NUMBER")
    assert duplicate.status_code == 201
    assert duplicate.json()["status"] == "REJECTED"
    as_role(browser, "verifier")
    approved = browser.post(f'/invoices/{detail["id"]}/approve', json={"verifier_name":"Reviewer", "recipient_confirmed":True, "confirmation_reference":"Recipient confirmed delivery in test"})
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "PAID"
    ledger = browser.get("/campaigns/1/ledger").json()
    assert browser.get(ledger[-1]["proof_url"]).content == png()


def test_missing_separate_proof_rejects_invoice(client):
    browser, engine, _ = client
    response = upload(browser, proof=False)
    assert response.status_code == 400
    assert "proof photo" in response.json()["detail"]
    with Session(engine) as db:
        assert db.query(Invoice).count() == 0


def test_spoofed_active_proof_is_rejected_before_persisting(client):
    browser, engine, _ = client
    response = browser.post("/invoices", data={"campaign_id":1,"budget_line_id":1,"invoice_number":"x"},
        files={"invoice_file":("invoice.png",png(),"image/png"),"proof_photo":("proof.html",b"<script>alert(1)</script>","image/png")})
    assert response.status_code == 415
    with Session(engine) as db:
        assert db.query(Invoice).count() == 0
        assert db.query(StoredFile).count() == 0


def test_approval_rechecks_budget_after_two_uploads(client):
    browser, _, extracted = client
    first = upload(browser).json()
    extracted.invoice_number = "DOCUMENT-2"
    second = upload(browser,"SECOND-FORM").json()
    assert first["status"] == second["status"] == "AWAITING_VERIFIER"
    as_role(browser, "verifier")
    assert browser.post(f'/invoices/{first["id"]}/approve',json={"verifier_name":"R", "recipient_confirmed":True, "confirmation_reference":"Recipient confirmed delivery in test"}).status_code == 200
    response = browser.post(f'/invoices/{second["id"]}/approve',json={"verifier_name":"R", "recipient_confirmed":True, "confirmation_reference":"Recipient confirmed delivery in test"})
    assert response.status_code == 409
    assert "budget" in response.json()["detail"]


@pytest.mark.parametrize("value", [-1, 0, float("inf"), float("nan"), 1.001])
def test_invalid_money_rejected(value):
    with pytest.raises(ValidationError):
        CampaignCreate(title="Test",goal_amount=value,organizer_name="O")
    with pytest.raises(ValidationError):
        DonationCreate(donor_name="D",amount=value)
    with pytest.raises(ValidationError):
        ExtractionResult(vendor_name="V",payout_email="v@example.com",invoice_number="1",amount=value,currency="USD",description="Work")


def test_campaign_rejects_foreign_vendor_assignment(client):
    browser, _, _ = client
    as_role(browser, "organizer")
    response=browser.post("/campaigns",json={"title":"Other","goal_amount":10,"organizer_name":"O",
        "budget_lines":[{"name":"Books","vendor_id":1,"budgeted_amount":10}]})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_simulated_balance_cannot_back_a_paypal_payout():
    db, campaign, _, invoice = setup_invoice()
    db.add(Donation(campaign_id=campaign.id,donor_name="Demo",amount=200,currency="USD",
        paypal_order_id="SIMULATED",source="simulated",status="captured"))
    db.commit()
    paypal=FakePayPal()
    await pay_available(db,invoice,paypal)
    assert paypal.sent == []
    assert campaign.pool_balance == 200
    assert invoice.status == "AWAITING_FUNDS"
    db.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("code",[500,502,503,504])
async def test_uncertain_payout_preserves_reservation_and_key(code):
    db, campaign, _, invoice = setup_invoice()
    class LostResponse(FakePayPal):
        async def create_payout(self,**kwargs):
            self.sent.append(kwargs)
            raise PayPalError(code,{"error":"upstream"})
    paypal=LostResponse()
    await pay_available(db,invoice,paypal)
    await pay_available(db,invoice,paypal)
    assert invoice.status == "PAYOUT_PENDING"
    assert len(invoice.installments) == 1
    assert invoice.installments[0].status == "pending"
    assert paypal.sent[0]["sender_batch_id"] == paypal.sent[1]["sender_batch_id"]
    assert campaign.pool_balance == 200
    db.close()


@pytest.mark.asyncio
async def test_poll_error_does_not_release_accepted_batch():
    db, campaign, _, invoice = setup_invoice()
    class PollError(FakePayPal):
        async def create_payout(self, **kwargs):
            self.sent.append(kwargs)
            return {"batch_header":{"payout_batch_id":"ACCEPTED"}}
        async def get_payout_status(self,batch_id):
            raise PayPalError(404,{"name":"temporarily_unavailable"})
    paypal=PollError()
    await pay_available(db,invoice,paypal)
    await pay_available(db,invoice,paypal)
    assert len(paypal.sent) == 1
    assert invoice.installments[0].status == "pending"
    assert invoice.installments[0].paypal_batch_id == "ACCEPTED"
    assert campaign.pool_balance == 200
    db.close()


@pytest.mark.asyncio
async def test_stale_status_cannot_regress_success():
    db, campaign, line, invoice=setup_invoice()
    await pay_available(db,invoice,FakePayPal())
    part=invoice.installments[0]
    _apply_status(db,part,{"items":[{"transaction_status":"UNCLAIMED"}]})
    _apply_status(db,part,{"items":[{"transaction_status":"SUCCESS"}]})
    assert part.status == "success"
    assert campaign.pool_balance == 0
    assert line.paid_amount == 200
    db.close()


def test_mismatched_capture_cannot_credit_balance():
    db,campaign,donation=_donation()
    result=_response("COMPLETED")
    result["purchase_units"][0]["payments"]["captures"][0]["amount"]["value"]="2500.00"
    with pytest.raises(HTTPException):
        main._store_capture_result(db,donation.paypal_order_id,result)
    assert campaign.pool_balance == 0
    assert donation.status == "created"
    db.close()


@pytest.mark.asyncio
async def test_capture_recovers_order_already_completed(monkeypatch):
    db,campaign,donation=_donation()
    response=_response("COMPLETED")
    paypal=NS(is_configured=True,get_order=AsyncMock(return_value=response),capture_order=AsyncMock())
    monkeypatch.setattr(main,"paypal",paypal)
    monkeypatch.setattr(main,"pay_campaign",AsyncMock())
    result=await main.capture_donation(donation.paypal_order_id,db)
    assert result.status == "captured"
    assert campaign.pool_balance == 25
    paypal.capture_order.assert_not_awaited()
    db.close()


@pytest.mark.asyncio
async def test_expired_token_is_refreshed(monkeypatch):
    client=PayPalClient()
    client._access_token="expired"
    client._token_expires_at=time.monotonic()-1
    refresh=AsyncMock(return_value="new")
    monkeypatch.setattr(client,"get_access_token",refresh)
    assert (await client._auth_headers())["Authorization"] == "Bearer new"
    refresh.assert_awaited_once()


def test_sandbox_name_in_untrusted_url_does_not_pass(monkeypatch):
    monkeypatch.setenv("PAYPAL_BASE_URL","https://sandbox.attacker.example")
    with pytest.raises(ValueError):
        load_env_credentials()


def test_no_key_extraction_does_not_invent_amount():
    import extraction
    with pytest.raises(extraction.ExtractionError):
        extraction._heuristic_extract("Unreadable document","invoice.png")


def test_rate_limit_applies_to_verifier_attempts(client,monkeypatch):
    browser,_,_=client
    browser.cookies.clear()
    monkeypatch.setattr(settings,"write_rate_limit",1)
    assert browser.post("/invoices/1/approve",json={"verifier_name":"R", "recipient_confirmed":True, "confirmation_reference":"Recipient confirmed delivery in test"}).status_code == 401
    assert browser.post("/invoices/1/approve",json={"verifier_name":"R", "recipient_confirmed":True, "confirmation_reference":"Recipient confirmed delivery in test"}).status_code == 429


def test_oversize_request_is_rejected_without_content_length(client,monkeypatch):
    browser,_,_=client
    monkeypatch.setattr(settings,"max_upload_bytes",1)
    response=browser.post("/invoices",content=iter([b"x"*40000,b"x"*40000]))
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_missing_credentials_cannot_confirm_a_real_batch(monkeypatch):
    client=PayPalClient()
    monkeypatch.setattr(client,"_client_id","")
    monkeypatch.setattr(client,"_client_secret","")
    with pytest.raises(PayPalError):
        await client.get_payout_status("REAL-BATCH")
    with pytest.raises(PayPalError):
        await client.capture_order("REAL-ORDER")


@pytest.mark.asyncio
async def test_401_refreshes_token_and_retries_same_capture_request(monkeypatch):
    client=PayPalClient()
    monkeypatch.setattr(client,"_client_id","test-id")
    monkeypatch.setattr(client,"_client_secret","test-secret")
    client._access_token="stale"
    client._token_expires_at=time.monotonic()+300
    async def refresh():
        client._access_token="fresh"
        client._token_expires_at=time.monotonic()+300
        return "fresh"
    monkeypatch.setattr(client,"get_access_token",refresh)
    sent=[]
    async def post(self,url,**kwargs):
        sent.append(dict(kwargs["headers"]))
        return httpx.Response(401 if len(sent)==1 else 201,json={} if len(sent)==1 else {"id":"ORDER"},request=httpx.Request("POST",url))
    monkeypatch.setattr(httpx.AsyncClient,"post",post)
    await client.capture_order("ORDER")
    assert [headers["Authorization"] for headers in sent] == ["Bearer stale","Bearer fresh"]
    assert sent[0]["PayPal-Request-Id"] == sent[1]["PayPal-Request-Id"] == "capture-ORDER"


@pytest.mark.asyncio
async def test_duplicate_batch_response_reconciles_original_transfer(monkeypatch):
    client=PayPalClient()
    monkeypatch.setattr(client,"_client_id","test-id")
    monkeypatch.setattr(client,"_client_secret","test-secret")
    duplicate={"name":"DUPLICATE_BATCH_ID","links":[{"rel":"self","href":"https://api-m.sandbox.paypal.com/v1/payments/payouts/ORIGINAL"}]}
    monkeypatch.setattr(client,"_request",AsyncMock(side_effect=PayPalError(400,duplicate)))
    lookup=AsyncMock(return_value={"batch_header":{"payout_batch_id":"ORIGINAL"}})
    monkeypatch.setattr(client,"get_payout_status",lookup)
    response=await client.create_payout(invoice_id=1,installment_id=2,amount=10,currency="USD",payout_email="v@example.com",vendor_name="V",sender_batch_id="saved-key")
    assert response["batch_header"]["payout_batch_id"] == "ORIGINAL"
    lookup.assert_awaited_once_with("ORIGINAL")


def test_identical_document_rejected_even_if_extraction_number_changes(client):
    browser,_,extracted=client
    first=upload(browser).json()
    extracted.invoice_number="CHANGED"
    second=upload(browser).json()
    assert first["status"] == "AWAITING_VERIFIER"
    assert second["status"] == "REJECTED"
    assert any(row["check_name"]=="no_duplicate" and not row["passed"] for row in second["checks"])


def test_oversized_file_is_rejected_before_invoice_persistence(client,monkeypatch):
    browser,engine,_=client
    monkeypatch.setattr(settings,"max_upload_bytes",4)
    response=upload(browser)
    assert response.status_code == 413
    with Session(engine) as db:
        assert db.query(Invoice).count() == 0


def test_response_timestamps_identify_utc(client):
    browser,_,_=client
    assert browser.get("/campaigns/1").json()["created_at"].endswith("+00:00")


@pytest.mark.asyncio
async def test_bundled_invoice_fallback_reads_labeled_fields(monkeypatch):
    from pathlib import Path
    import extraction
    monkeypatch.setattr(settings,"llm_api_key","")
    monkeypatch.delenv("GEMINI_API_KEY",raising=False)
    path=Path(__file__).resolve().parents[2]/"sample_invoices/vendor_a_shelves_valid.pdf"
    result=await extraction.extract_invoice(str(path),"application/pdf")
    assert result.invoice_number == "SHELVES-001"
    assert result.amount == 400
    assert result.currency == "USD"
    assert result.payout_email == "vendor-a@example.com"


def test_fallback_uses_total_and_explicit_currency_not_first_line_item():
    import extraction
    result=extraction._heuristic_extract(
        "Invoice number: INV-1\nPayout email: v@example.com\nItem: $12.00\nTOTAL DUE 35.00 EUR\n", "invoice.pdf")
    assert result.amount == 35
    assert result.currency == "EUR"
