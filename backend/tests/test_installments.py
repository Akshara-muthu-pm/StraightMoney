from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from db import Base
from models import Campaign, Vendor, BudgetLine, Invoice, Verification, PayoutInstallment
from installments import pay_available, pay_campaign
import pytest


class FakePayPal:
    def __init__(self):
        self.sent = []

    async def create_payout(self, **kwargs):
        self.sent.append(kwargs)
        return {"batch_header": {"payout_batch_id": f"BATCH-{len(self.sent)}"},
                "items": [{"transaction_status": "SUCCESS"}]}

    async def get_payout_status(self, batch_id):
        return {"batch_header": {"payout_batch_id": batch_id},
                "items": [{"transaction_status": "SUCCESS"}]}


def setup_invoice():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = Session(engine)
    campaign = Campaign(title="Test", goal_amount=1000, currency="USD", pool_balance=200,
                        status="active", organizer_name="Organizer")
    db.add(campaign)
    db.flush()
    vendor = Vendor(campaign_id=campaign.id, name="Vendor", payout_email="vendor@example.com", status="active")
    db.add(vendor)
    db.flush()
    line = BudgetLine(campaign_id=campaign.id, name="Work", vendor_id=vendor.id, budgeted_amount=1000, paid_amount=0)
    db.add(line)
    db.flush()
    invoice = Invoice(campaign_id=campaign.id, budget_line_id=line.id, vendor_id=vendor.id,
                      invoice_number="INV-1", amount=1000, currency="USD", payout_email=vendor.payout_email,
                      status="AWAITING_FUNDS")
    db.add(invoice)
    db.flush()
    db.add(Verification(invoice_id=invoice.id, verifier_name="Reviewer", decision="approve"))
    db.commit()
    return db, campaign, line, invoice


@pytest.mark.asyncio
async def test_partial_then_later_donation_finishes_invoice():
    db, campaign, line, invoice = setup_invoice()
    paypal = FakePayPal()
    await pay_available(db, invoice, paypal)
    assert invoice.status == "PARTIALLY_PAID"
    assert invoice.paid_amount == 200
    assert invoice.remaining_amount == 800
    assert campaign.pool_balance == 0
    campaign.pool_balance += 800
    db.commit()
    await pay_campaign(db, campaign.id, paypal)
    assert invoice.status == "PAID"
    assert invoice.paid_amount == 1000
    assert line.paid_amount == 1000
    assert campaign.pool_balance == 0
    assert [item["amount"] for item in paypal.sent] == [200, 800]
    assert paypal.sent[0]["installment_id"] != paypal.sent[1]["installment_id"]
    db.close()


@pytest.mark.asyncio
async def test_zero_balance_waits_without_sending():
    db, campaign, line, invoice = setup_invoice()
    campaign.pool_balance = 0
    db.commit()
    paypal = FakePayPal()
    await pay_available(db, invoice, paypal)
    assert invoice.status == "AWAITING_FUNDS"
    assert paypal.sent == []
    db.close()


@pytest.mark.asyncio
async def test_pending_transfer_is_reconciled_without_duplicate_send():
    db, campaign, line, invoice = setup_invoice()
    class PendingPayPal(FakePayPal):
        async def create_payout(self, **kwargs):
            self.sent.append(kwargs)
            return {"batch_header": {"payout_batch_id": "BATCH-PENDING"},
                    "items": [{"transaction_status": "UNCLAIMED"}]}

        async def get_payout_status(self, batch_id):
            return {"batch_header": {"payout_batch_id": batch_id},
                    "items": [{"transaction_status": "SUCCESS"}]}
    paypal = PendingPayPal()
    await pay_available(db, invoice, paypal)
    assert invoice.status == "PARTIALLY_PAID"
    assert campaign.pool_balance == 0
    await pay_available(db, invoice, paypal)
    assert len(paypal.sent) == 1
    assert len(invoice.installments) == 1
    db.close()


def test_installment_detail_exposes_remaining_amount():
    from schemas import InvoiceDetail
    db, campaign, line, invoice = setup_invoice()
    detail = InvoiceDetail.model_validate(invoice)
    assert detail.paid_amount == 0
    assert detail.remaining_amount == 1000
    assert detail.installments == []
    db.close()


def test_rejected_invoice_cannot_be_approved():
    from main import _guard_invoice_status
    from fastapi import HTTPException
    db, campaign, line, invoice = setup_invoice()
    invoice.status = "REJECTED"
    db.commit()
    with pytest.raises(HTTPException) as error:
        _guard_invoice_status(invoice, "AWAITING_VERIFIER")
    assert error.value.status_code == 409
    db.close()


def test_verifier_payload_rejects_removed_override():
    from pydantic import ValidationError
    from schemas import VerificationCreate
    with pytest.raises(ValidationError):
        VerificationCreate(verifier_name="Reviewer", override_for_testing=True)


@pytest.mark.asyncio
async def test_verifier_request_returns_when_paypal_stalls(monkeypatch):
    import asyncio
    import main
    from unittest.mock import AsyncMock
    from schemas import VerificationCreate
    from models import AuditLog
    db, campaign, line, invoice = setup_invoice()
    db.query(Verification).delete()
    invoice.status = "AWAITING_VERIFIER"
    db.commit()

    async def stalled_payment(*args):
        await asyncio.sleep(1)

    from models import StoredFile
    db.add(StoredFile(invoice_id=invoice.id, kind="proof", filename="proof.png", mime_type="image/png", data=b"fixture"))
    db.commit()
    monkeypatch.setattr(main, "pay_available", stalled_payment)
    monkeypatch.setattr(main, "_PAYOUT_WAIT_SECONDS", 0.01)
    result = await main.approve_invoice(invoice.id, VerificationCreate(verifier_name="Reviewer", recipient_confirmed=True, confirmation_reference="Recipient confirmed complete delivery in test"), db)
    assert result.status == "AWAITING_FUNDS"
    assert db.query(AuditLog).filter_by(invoice_id=invoice.id, action="payout.response_timeout").count() == 1
    assert invoice.installments == []
    db.close()


@pytest.mark.asyncio
async def test_async_payout_surfaces_paypal_restriction(monkeypatch):
    import httpx
    from payments import PayPalClient, PayPalError
    from unittest.mock import AsyncMock
    client = PayPalClient()
    monkeypatch.setattr(client, "_client_id", "test-id")
    monkeypatch.setattr(client, "_client_secret", "test-secret")
    monkeypatch.setattr(client, "_auth_headers", AsyncMock(return_value={"Authorization": "Bearer TEST"}))

    async def restricted_post(self, url, **kwargs):
        return httpx.Response(403, json={"name": "PAYOUT_NOT_AVAILABLE"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", restricted_post)
    with pytest.raises(PayPalError) as error:
        await client.create_payout(invoice_id=123, installment_id=456, amount=10,
            currency="USD", payout_email="vendor@example.com", vendor_name="Vendor")
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_restricted_sender_fails_without_deducting_pool():
    from payments import PayPalError
    db, campaign, line, invoice = setup_invoice()

    class RestrictedPayPal(FakePayPal):
        async def create_payout(self, **kwargs):
            raise PayPalError(403, {"name": "PAYOUT_NOT_AVAILABLE",
                                   "message": "You live in a country that is not allowed to send this payout."})

    await pay_available(db, invoice, RestrictedPayPal())
    assert invoice.status == "FAILED"
    assert invoice.paid_amount == 0
    assert campaign.pool_balance == 200
    assert line.paid_amount == 0
    assert "sandbox sender account's country" in invoice.ai_summary
    assert "debug_id" not in invoice.ai_summary
    db.close()


@pytest.mark.asyncio
async def test_payout_worker_confirms_pending_transfer_without_resending(monkeypatch):
    import asyncio
    import main

    db, campaign, line, invoice = setup_invoice()
    invoice_id = invoice.id
    db.add(PayoutInstallment(invoice_id=invoice_id, amount=200, currency="USD",
                             sender_batch_id="original-key", paypal_batch_id="original-batch"))
    invoice.status = "PAYOUT_PENDING"
    db.commit()
    paypal = FakePayPal()

    passes = 0

    async def one_pass(_seconds):
        nonlocal passes
        passes += 1
        if passes > 1:
            raise asyncio.CancelledError

    monkeypatch.setattr(main, "SessionLocal", lambda: Session(db.bind))
    monkeypatch.setattr(main, "paypal", paypal)
    monkeypatch.setattr(main.asyncio, "sleep", one_pass)
    db.expire_all()

    with pytest.raises(asyncio.CancelledError):
        await main._reconcile_payout_queue()

    db.refresh(invoice)
    assert invoice.paid_amount == 200
    assert invoice.status == "PARTIALLY_PAID"
    assert paypal.sent == []
    db.close()


@pytest.mark.asyncio
async def test_missing_paypal_credentials_do_not_reserve_campaign_funds(monkeypatch):
    from payments import PayPalClient

    db, campaign, line, invoice = setup_invoice()
    paypal = PayPalClient()
    monkeypatch.setattr(paypal, "_client_id", "")
    await pay_available(db, invoice, paypal)

    assert invoice.status == "FAILED"
    assert invoice.installments[0].status == "failed"
    assert invoice.paid_amount == 0
    assert campaign.pool_balance == 200
    assert line.paid_amount == 0
    assert "Configure PayPal Sandbox credentials" in invoice.ai_summary
    db.close()
