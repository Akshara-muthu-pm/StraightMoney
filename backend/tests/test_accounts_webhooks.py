"""Account permissions and verified webhook accounting boundaries."""
import asyncio
import csv
import io
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import main
from auth import COOKIE_NAME
from config import settings
from db import Base, get_db
from models import AuditLog, BudgetLine, Campaign, DeliveryCloseout, Donation, Invoice, PaymentAdjustment, PayoutInstallment, ReconciliationIssue, User, Vendor, WebhookEvent
from payments import PayPalClient


@pytest.fixture
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)

    def override():
        with Session(engine) as db:
            yield db

    main.app.dependency_overrides[get_db] = override
    monkeypatch.setattr(settings, "verifier_key", "enrollment-secret")
    monkeypatch.setattr(settings, "write_rate_limit", 10000)
    browser = TestClient(main.app)
    try:
        yield browser, engine
    finally:
        main.app.dependency_overrides.clear()
        engine.dispose()


def _register(browser, role, email, **extra):
    return browser.post(f"/auth/register-{role}", json={"name": role.title(), "email": email,
        "password": "A strong password 123!", **extra})


def test_roles_and_vendor_assignment_are_enforced(client):
    browser, _ = client
    payload = {"title": "Garden", "goal_amount": 100, "organizer_name": "Spoofed",
        "vendors": [{"name": "Supplier", "payout_email": "supplier@example.com"},
                    {"name": "Other", "payout_email": "other@example.com"}],
        "budget_lines": [{"name": "Soil", "budgeted_amount": 100,
                          "vendor_name": "Supplier", "vendor_payout_email": "supplier@example.com"},
                         {"name": "Tools", "budgeted_amount": 50,
                          "vendor_name": "Other", "vendor_payout_email": "other@example.com"}]}
    assert browser.post("/campaigns", json=payload).status_code == 401
    assert _register(browser, "organizer", "owner@example.com").status_code == 201
    created = browser.post("/campaigns", json=payload)
    assert created.status_code == 201, created.text
    campaign = created.json()
    assert campaign["organizer_name"] == "Organizer"
    invite = browser.post(f"/auth/campaigns/{campaign['id']}/vendors/{campaign['vendors'][0]['id']}/invite")
    assert invite.status_code == 200
    assert browser.post("/invoices", data={"campaign_id": campaign["id"], "budget_line_id": campaign["budget_lines"][0]["id"], "invoice_number": "A"}).status_code == 403
    browser.post("/auth/logout")
    vendor = _register(browser, "vendor", "supplier@example.com", invite_token=invite.json()["invite_token"])
    assert vendor.status_code == 201, vendor.text
    assert browser.get("/auth/my-campaigns").json()[0]["id"] == campaign["id"]
    assert browser.post("/campaigns", json=payload).status_code == 403
    assert browser.post("/invoices", data={"campaign_id": campaign["id"],
        "budget_line_id": campaign["budget_lines"][1]["id"],
        "vendor_id": campaign["vendors"][0]["id"], "invoice_number": "A"}).status_code == 403
    assert browser.post("/auth/accept-vendor-invite", headers={"Origin": "https://attacker.example"},
        json={"invite_token": "x" * 40}).status_code == 403
    assert browser.post("/invoices", data={"campaign_id": campaign["id"], "budget_line_id": campaign["budget_lines"][0]["id"], "invoice_number": "A"}).status_code == 400
    assert browser.post("/invoices", data={"campaign_id": campaign["id"], "budget_line_id": 999, "invoice_number": "A"}).status_code == 404
    assert browser.post("/invoices/999/approve", json={"verifier_name": "Fake"}).status_code == 403
    browser.post("/auth/logout")
    assert _register(browser, "verifier", "reviewer@example.com", bootstrap_key="enrollment-secret").status_code == 201
    assert browser.post("/invoices/999/approve", json={"verifier_name": "Fake"}).status_code == 404
    assert browser.post("/campaigns", json=payload).status_code == 403


def _capture_event(event_id="WH-CAPTURE"):
    return {"id": event_id, "event_type": "PAYMENT.CAPTURE.COMPLETED", "resource": {
        "id": "CAPTURE-1", "supplementary_data": {"related_ids": {"order_id": "ORDER-1"}}}}


def _order(amount="40.00"):
    return {"id": "ORDER-1", "status": "COMPLETED", "purchase_units": [{"payments": {"captures": [
        {"id": "CAPTURE-1", "status": "COMPLETED", "amount": {"value": amount, "currency_code": "USD"}}
    ]}}]}


def test_verified_capture_is_idempotent_and_mismatch_is_flagged(client, monkeypatch):
    browser, engine = client
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Garden", goal_amount=100, currency="USD", pool_balance=0,
                        status="active", organizer_name="Owner"))
        db.add(Donation(campaign_id=1, donor_name="Donor", amount=40, currency="USD",
                        paypal_order_id="ORDER-1", source="paypal", status="pending"))
        db.commit()
    fake = SimpleNamespace(verify_webhook_signature=AsyncMock(return_value=False),
                           get_order=AsyncMock(return_value=_order()), is_configured=True)
    monkeypatch.setattr(main, "paypal", fake)
    assert browser.post("/webhooks/paypal", json=_capture_event()).status_code == 401
    with Session(engine) as db:
        assert db.get(Campaign, 1).pool_balance == 0
        assert db.get(WebhookEvent, "WH-CAPTURE") is None
    fake.verify_webhook_signature.return_value = True
    result = browser.post("/webhooks/paypal", json=_capture_event())
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "processed"
    assert browser.post("/webhooks/paypal", json=_capture_event()).status_code == 200
    with Session(engine) as db:
        assert db.get(Campaign, 1).pool_balance == 40
        assert db.query(Donation).filter_by(paypal_order_id="ORDER-1").one().status == "captured"
    fake.get_order.return_value = _order("41.00")
    mismatch = browser.post("/webhooks/paypal", json=_capture_event("WH-MISMATCH"))
    assert mismatch.json()["status"] == "flagged"
    with Session(engine) as db:
        assert db.get(Campaign, 1).pool_balance == 40
        assert db.query(ReconciliationIssue).count() == 1


def test_verified_payout_reconciles_once_and_flags_conflict(client, monkeypatch):
    browser, engine = client
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Garden", goal_amount=100, currency="USD", pool_balance=100,
                        status="active", organizer_name="Owner"))
        db.flush()
        db.add(Donation(campaign_id=1, donor_name="Donor", amount=100, currency="USD",
                        paypal_order_id="ORDER-PAYOUT", source="paypal", status="captured"))
        db.add(Vendor(id=1, campaign_id=1, name="Supplier", payout_email="supplier@example.com", status="active"))
        db.flush()
        db.add(BudgetLine(id=1, campaign_id=1, name="Soil", vendor_id=1, budgeted_amount=100, paid_amount=0))
        db.flush()
        db.add(Invoice(id=1, campaign_id=1, budget_line_id=1, vendor_id=1, invoice_number="INV-1",
                       amount=60, currency="USD", payout_email="supplier@example.com", status="PAYOUT_PENDING"))
        db.flush()
        db.add(PayoutInstallment(invoice_id=1, amount=60, currency="USD", status="pending",
                                 sender_batch_id="ITEM-1", paypal_batch_id="BATCH-1"))
        db.commit()
    payout = {"batch_header": {"payout_batch_id": "BATCH-1", "batch_status": "SUCCESS"}, "items": [
        {"transaction_status": "SUCCESS", "payout_item": {"sender_item_id": "ITEM-1",
         "amount": {"value": "60.00", "currency": "USD"}, "receiver": "supplier@example.com"}}
    ]}
    fake = SimpleNamespace(verify_webhook_signature=AsyncMock(return_value=True),
                           get_payout_status=AsyncMock(return_value=payout), is_configured=True)
    monkeypatch.setattr(main, "paypal", fake)
    event = {"id": "WH-PAYOUT", "event_type": "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", "resource": {
        "payout_batch_id": "BATCH-1", "payout_item": {"sender_item_id": "ITEM-1"}}}
    result = browser.post("/webhooks/paypal", json=event)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "processed"
    assert browser.post("/webhooks/paypal", json=event).status_code == 200
    with Session(engine) as db:
        assert db.get(Campaign, 1).pool_balance == 40
        assert db.get(BudgetLine, 1).paid_amount == 60
    assert [item["kind"] for item in browser.get("/donations/ORDER-PAYOUT/updates").json()] == ["paid"]
    fake.get_payout_status.return_value = {**payout, "items": [{**payout["items"][0], "transaction_status": "FAILED"}]}
    conflict = browser.post("/webhooks/paypal", json={**event, "id": "WH-CONFLICT", "event_type": "PAYMENT.PAYOUTS-ITEM.FAILED"})
    assert conflict.json()["status"] == "flagged"
    with Session(engine) as db:
        assert db.get(Campaign, 1).pool_balance == 40
        assert db.query(ReconciliationIssue).count() == 1


def test_paypal_signature_verification_uses_configured_webhook_id(monkeypatch):
    paypal = PayPalClient()
    paypal._client_id = "test-client"
    paypal._client_secret = "test-secret"
    monkeypatch.setattr(settings, "paypal_webhook_id", "WH-CONFIGURED")
    request = AsyncMock(return_value={"verification_status": "SUCCESS"})
    monkeypatch.setattr(paypal, "_request", request)
    headers = {key: "value" for key in ("paypal-auth-algo", "paypal-cert-url",
        "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time")}
    event = _capture_event()
    assert asyncio.run(paypal.verify_webhook_signature(headers, event)) is True
    args = request.await_args.args
    assert args[0] == "POST"
    assert args[1].endswith("/v1/notifications/verify-webhook-signature")
    assert args[2]["webhook_id"] == "WH-CONFIGURED"
    assert args[2]["webhook_event"] == event
    assert asyncio.run(paypal.verify_webhook_signature({}, event)) is False
    assert request.await_count == 1


def test_delivery_closeout_requires_assigned_vendor_and_organizer_acceptance(client):
    browser, engine = client
    owner = _register(browser, "organizer", "owner@example.com").json()
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Garden", goal_amount=100, currency="USD", pool_balance=40,
                        status="active", organizer_name="Owner", organizer_user_id=owner["id"]))
        db.flush()
        db.add(Vendor(id=1, campaign_id=1, name="Supplier", payout_email="supplier@example.com"))
        db.add(BudgetLine(id=1, campaign_id=1, name="Soil", vendor_id=1, budgeted_amount=60, paid_amount=60))
        db.add(Invoice(id=1, campaign_id=1, budget_line_id=1, vendor_id=1, invoice_number="INV-1",
                       amount=60, currency="USD", payout_email="supplier@example.com", status="PAID"))
        db.commit()
    assert browser.post("/invoices/1/delivery/accept", json={}).status_code == 409
    invite = browser.post("/auth/campaigns/1/vendors/1/invite").json()["invite_token"]
    browser.post("/auth/logout")
    assert _register(browser, "vendor", "supplier@example.com", invite_token=invite).status_code == 201
    report = browser.post("/invoices/1/delivery", json={"delivered_description": "Installed 3 shelves",
        "delivered_at": "2026-01-01T12:00:00Z"})
    assert report.status_code == 200, report.text
    assert report.json()["status"] == "reported"
    assert browser.post("/invoices/1/delivery/accept", json={}).status_code == 403
    browser.post("/auth/logout")
    assert browser.post("/auth/login", json={"email": "owner@example.com", "password": "A strong password 123!"}).status_code == 200
    accepted = browser.post("/invoices/1/delivery/accept", json={"remaining_issue": "One shelf needs repainting"})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "issues_open"
    assert accepted.json()["accepted_at"] is not None
    invoice = browser.get("/invoices/1").json()
    assert invoice["delivery"]["remaining_issue"] == "One shelf needs repainting"
    ledger = browser.get("/campaigns/1/ledger").json()
    assert any(row["type"] == "delivery" and "repainting" in row["detail"] for row in ledger)


def test_cancel_refund_and_dispute_webhooks_reconcile_public_balance(client, monkeypatch):
    browser, engine = client
    owner = _register(browser, "organizer", "owner@example.com").json()
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Garden", goal_amount=100, currency="USD", pool_balance=100,
                        status="active", organizer_name="Owner", organizer_user_id=owner["id"]))
        db.add(Donation(campaign_id=1, donor_name="Donor", amount=100, currency="USD", source="paypal",
                        status="captured", paypal_order_id="ORDER-1", paypal_capture_id="CAP-1"))
        db.commit()
    cancelled = browser.post("/campaigns/1/cancel", json={"reason": "Project cannot continue"})
    assert cancelled.status_code == 200, cancelled.text
    assert browser.get("/campaigns/1").json()["cancellation_reason"] == "Project cannot continue"
    assert browser.post("/campaigns/1/donations", json={"donor_name": "New", "amount": 10}).status_code == 400
    capture = {"id": "CAP-1", "status": "PARTIALLY_REFUNDED", "seller_receivable_breakdown": {
        "total_refunded_amount": {"value": "40.00", "currency_code": "USD"}}}
    dispute = {"dispute_id": "DISPUTE-1", "status": "UNDER_REVIEW", "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        "dispute_amount": {"value": "30.00", "currency_code": "USD"},
        "disputed_transactions": [{"seller_transaction_id": "CAP-1"}]}
    fake = SimpleNamespace(verify_webhook_signature=AsyncMock(return_value=True),
        get_capture=AsyncMock(return_value=capture), get_dispute=AsyncMock(return_value=dispute))
    monkeypatch.setattr(main, "paypal", fake)
    refund_event = {"id": "WH-REFUND", "event_type": "PAYMENT.CAPTURE.REFUNDED", "resource": {"id": "CAP-1"}}
    assert browser.post("/webhooks/paypal", json=refund_event).json()["status"] == "processed"
    assert browser.post("/webhooks/paypal", json=refund_event).json()["status"] == "processed"
    assert browser.get("/campaigns/1").json()["pool_balance"] == 60
    dispute_event = {"id": "WH-DISPUTE-1", "event_type": "CUSTOMER.DISPUTE.CREATED", "resource": {"dispute_id": "DISPUTE-1"}}
    assert browser.post("/webhooks/paypal", json=dispute_event).json()["status"] == "processed"
    assert browser.get("/campaigns/1").json()["pool_balance"] == 30
    fake.get_dispute.return_value = {**dispute, "status": "RESOLVED",
        "dispute_outcome": {"outcome_code": "RESOLVED_SELLER_FAVOUR"}}
    assert browser.post("/webhooks/paypal", json={**dispute_event, "id": "WH-DISPUTE-2",
        "event_type": "CUSTOMER.DISPUTE.RESOLVED"}).json()["status"] == "processed"
    assert browser.get("/campaigns/1").json()["pool_balance"] == 60
    second_dispute = {**dispute, "dispute_id": "DISPUTE-2", "status": "RESOLVED",
        "dispute_outcome": {"outcome_code": "RESOLVED_BUYER_FAVOUR"}}
    fake.get_dispute.return_value = second_dispute
    assert browser.post("/webhooks/paypal", json={**dispute_event, "id": "WH-DISPUTE-3",
        "resource": {"dispute_id": "DISPUTE-2"}}).json()["status"] == "processed"
    assert browser.get("/campaigns/1").json()["pool_balance"] == 30
    fake.get_capture.return_value = {**capture, "status": "REFUNDED", "seller_receivable_breakdown": {
        "total_refunded_amount": {"value": "100.00", "currency_code": "USD"}}}
    assert browser.post("/webhooks/paypal", json={**refund_event, "id": "WH-REFUND-FULL"}).json()["status"] == "processed"
    assert browser.get("/campaigns/1").json()["pool_balance"] == 0
    donor_status = browser.get("/donations/ORDER-1/status").json()
    assert donor_status["unavailable_amount"] == 100
    assert {row["kind"] for row in donor_status["adjustments"]} == {"refund", "dispute"}
    ledger = browser.get("/campaigns/1/ledger").json()
    assert any(row["type"] == "refund" and row["amount"] == -100 for row in ledger)
    assert any(row["type"] == "dispute" and row["status"] == "seller_favor" for row in ledger)
    assert any(row["type"] == "dispute" and row["status"] == "buyer_favor" for row in ledger)
    assert any(row["type"] == "campaign" and row["status"] == "cancelled" for row in ledger)


def test_organizer_full_refund_uses_stable_request_and_updates_balance(client, monkeypatch):
    browser, engine = client
    owner = _register(browser, "organizer", "owner@example.com").json()
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Garden", goal_amount=100, currency="USD", pool_balance=100,
                        status="closed", organizer_name="Owner", organizer_user_id=owner["id"]))
        db.add(Donation(id=1, campaign_id=1, donor_name="Donor", amount=100, currency="USD", source="paypal",
                        status="captured", paypal_order_id="ORDER-1", paypal_capture_id="CAP-1"))
        db.commit()
    fake = SimpleNamespace(refund_capture=AsyncMock(return_value={"id": "RF-1", "status": "COMPLETED",
        "amount": {"value": "100.00", "currency_code": "USD"}}))
    monkeypatch.setattr(main, "paypal", fake)
    result = browser.post("/donations/1/refund")
    assert result.status_code == 200, result.text
    assert result.json()["unavailable_amount"] == 100
    browser.post("/auth/logout")
    assert browser.post("/donations/1/refund").status_code == 401
    assert browser.post("/auth/login", json={"email": "owner@example.com", "password": "A strong password 123!"}).status_code == 200
    assert browser.post("/donations/1/refund").status_code == 200
    assert fake.refund_capture.await_count == 1
    assert browser.get("/campaigns/1").json()["pool_balance"] == 0
    assert any(row["type"] == "refund" and row["amount"] == -100 for row in browser.get("/campaigns/1/ledger").json())


def test_failed_refund_is_visible_and_can_be_retried(client, monkeypatch):
    browser, engine = client
    owner = _register(browser, "organizer", "owner@example.com").json()
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Garden", goal_amount=100, currency="USD", pool_balance=100,
                        status="closed", organizer_name="Owner", organizer_user_id=owner["id"]))
        db.add(Donation(id=1, campaign_id=1, donor_name="Donor", amount=100, currency="USD", source="paypal",
                        status="captured", paypal_order_id="ORDER-1", paypal_capture_id="CAP-1"))
        db.commit()
    fake = SimpleNamespace(refund_capture=AsyncMock(return_value={"id": "RF-1", "status": "PENDING",
        "amount": {"value": "100.00", "currency_code": "USD"}}),
        verify_webhook_signature=AsyncMock(return_value=True), get_refund=AsyncMock(return_value={
            "id": "RF-1", "status": "FAILED", "amount": {"value": "100.00", "currency_code": "USD"},
            "links": [{"rel": "up", "href": "https://api-m.sandbox.paypal.com/v2/payments/captures/CAP-1"}]}))
    monkeypatch.setattr(main, "paypal", fake)
    assert browser.post("/donations/1/refund").json()["refund_requested"] is True
    assert browser.get("/campaigns/1").json()["pool_balance"] == 100
    event = {"id": "WH-REFUND-FAILED", "event_type": "PAYMENT.REFUND.FAILED", "resource": {"id": "RF-1"}}
    assert browser.post("/webhooks/paypal", json=event).json()["status"] == "processed"
    status = browser.get("/donations/ORDER-1/status").json()
    assert status["refund_requested"] is False
    assert status["adjustments"][0]["status"] == "failed"
    assert browser.get("/campaigns/1").json()["pool_balance"] == 100
    fake.refund_capture.return_value = {"id": "RF-2", "status": "COMPLETED",
        "amount": {"value": "100.00", "currency_code": "USD"}}
    assert browser.post("/donations/1/refund").json()["unavailable_amount"] == 100
    assert fake.refund_capture.await_args_list[0].args[1] != fake.refund_capture.await_args_list[1].args[1]


def test_pending_remainder_does_not_deduct_an_earlier_partial_refund_twice(client, monkeypatch):
    browser, engine = client
    owner = _register(browser, "organizer", "owner@example.com").json()
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Garden", goal_amount=100, currency="USD", pool_balance=60,
                        status="closed", organizer_name="Owner", organizer_user_id=owner["id"]))
        db.add(Donation(id=1, campaign_id=1, donor_name="Donor", amount=100, currency="USD", source="paypal",
                        status="captured", paypal_order_id="ORDER-1", paypal_capture_id="CAP-1", unavailable_amount=40))
        db.add(PaymentAdjustment(donation_id=1, kind="refund", reference="capture:CAP-1", amount=40, status="completed"))
        db.commit()
    fake = SimpleNamespace(refund_capture=AsyncMock(return_value={"id": "RF-2", "status": "PENDING",
        "amount": {"value": "60.00", "currency_code": "USD"}}))
    monkeypatch.setattr(main, "paypal", fake)
    assert browser.post("/donations/1/refund").status_code == 200
    assert browser.get("/campaigns/1").json()["pool_balance"] == 60
    status = browser.get("/donations/ORDER-1/status").json()
    assert sorted(row["status"] for row in status["adjustments"]) == ["completed", "pending"]
    assert sum(row["amount"] for row in browser.get("/campaigns/1/ledger").json() if row["type"] == "refund") == -40


def test_donor_updates_and_report_follow_saved_milestones(client):
    browser, engine = client
    owner = _register(browser, "organizer", "owner@example.com").json()
    with Session(engine) as db:
        db.add(Campaign(id=1, title="Library", goal_amount=100, currency="USD", pool_balance=40,
                        status="active", organizer_name="Owner", organizer_user_id=owner["id"]))
        db.add(Campaign(id=2, title="Other", goal_amount=100, currency="USD", pool_balance=0,
                        status="active", organizer_name="Other"))
        db.flush()
        db.add(Donation(id=1, campaign_id=1, donor_name='=HYPERLINK("x")', amount=100, currency="USD",
                        source="paypal", status="captured", paypal_order_id="ORDER-1"))
        db.add(Donation(id=2, campaign_id=1, donor_name="Waiting", amount=5, currency="USD",
                        source="paypal", status="pending", paypal_order_id="ORDER-2"))
        db.add(Vendor(id=1, campaign_id=1, name="Supplier", payout_email="supplier@example.com"))
        db.add(BudgetLine(id=1, campaign_id=1, name="Books", vendor_id=1, budgeted_amount=60, paid_amount=60))
        db.add(Invoice(id=1, campaign_id=1, budget_line_id=1, vendor_id=1, invoice_number="INV-1",
                       amount=60, currency="USD", payout_email="supplier@example.com", status="PAID",
                       raw_file_path="files/10", evidence_path="files/11"))
        db.add(Invoice(id=2, campaign_id=2, budget_line_id=1, vendor_id=1, invoice_number="OTHER",
                       amount=1, currency="USD", payout_email="supplier@example.com", status="PAID"))
        db.flush()
        db.add(PayoutInstallment(invoice_id=1, amount=60, currency="USD", status="success",
                                 sender_batch_id="ITEM-1", paypal_batch_id="BATCH-1"))
        db.add(DeliveryCloseout(invoice_id=1, delivered_description="Sixty books delivered",
                                delivered_at=datetime(2026, 1, 1), reported_by_user_id=owner["id"],
                                accepted_at=datetime(2026, 1, 2), accepted_by_user_id=owner["id"], status="accepted"))
        db.add(AuditLog(action="invoice.approved", actor="verifier", invoice_id=1, campaign_id=1))
        db.add(AuditLog(action="payout.success", actor="system", invoice_id=1, campaign_id=1,
                        detail='{"invoice_status":"PARTIALLY_PAID"}'))
        db.add(AuditLog(action="payout.success", actor="system", invoice_id=1, campaign_id=1,
                        detail='{"invoice_status":"PAID"}'))
        db.add(AuditLog(action="delivery.accepted", actor="organizer", invoice_id=1, campaign_id=1))
        db.add(AuditLog(action="invoice.approved", actor="verifier", invoice_id=2, campaign_id=2))
        db.commit()
    assert browser.get("/donations/ORDER-2/updates").json() == []
    assert browser.get("/donations/UNKNOWN/updates").status_code == 404
    updates = browser.get("/donations/ORDER-1/updates")
    assert updates.status_code == 200, updates.text
    assert [item["kind"] for item in updates.json()] == ["approved", "paid", "delivered"]
    assert all(item["campaign_id"] == 1 and item["proof_url"] == "/files/11" for item in updates.json())
    report = browser.get("/campaigns/1/report.csv")
    assert report.status_code == 200
    assert "attachment" in report.headers["content-disposition"]
    rows = list(csv.DictReader(io.StringIO(report.content.decode("utf-8-sig"))))
    assert len(rows) == len(browser.get("/campaigns/1/ledger").json())
    assert any(row["entry_type"] == "donation" and row["actor"].startswith("'=HYPERLINK") for row in rows)
    assert any(row["entry_type"] == "payout" and row["invoice_url"].endswith("/files/10")
               and row["delivery_proof_url"].endswith("/files/11") for row in rows)
