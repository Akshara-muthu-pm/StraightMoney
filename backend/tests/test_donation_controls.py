import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from config import settings
from db import Base, get_db
import main
from main import app
from models import BudgetLine, Campaign, Donation, User, UserSession
from auth import COOKIE_NAME, _digest, _now
from datetime import datetime, timedelta, timezone
from schemas import DonationCreate


@pytest.fixture(autouse=True)
def reset_rate_limits():
    from guards import _requests
    _requests.clear()
    yield
    _requests.clear()


@pytest.mark.parametrize("amount", [0, -1])
def test_zero_and_negative_donations_are_rejected(amount: float):
    with pytest.raises(ValidationError):
        DonationCreate(donor_name="Donor", amount=amount)


def test_donation_maximum_uses_setting(monkeypatch):
    monkeypatch.setattr(settings, "max_donation_amount", 20)
    DonationCreate(donor_name="Donor", amount=20)
    with pytest.raises(ValidationError):
        DonationCreate(donor_name="Donor", amount=20.01)


@pytest.fixture
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Campaign(title="Test", goal_amount=100, currency="USD", pool_balance=0,
                        status="active", organizer_name="Organizer"))
        db.commit()

    def session_override():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = session_override
    monkeypatch.setattr(settings, "allow_simulated_donations", False)
    monkeypatch.setattr(settings, "max_donation_amount", 5000)
    monkeypatch.setattr(settings, "verifier_key", "test-verifier-key")
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_simulation_is_forbidden_when_disabled(client):
    response = client.post("/campaigns/1/donations", json={"donor_name": "Donor", "amount": 10, "simulate": True})
    assert response.status_code == 403


@pytest.mark.parametrize("amount", [0, -1, 5000.01])
def test_invalid_amounts_return_422(client, amount: float):
    response = client.post("/campaigns/1/donations", json={"donor_name": "Donor", "amount": amount})
    assert response.status_code == 422


def test_simulated_source_is_persisted_and_visible_in_ledger(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_simulated_donations", True)
    created = client.post("/campaigns/1/donations", json={"donor_name": "Donor", "amount": 10, "simulate": True})
    assert created.status_code == 201
    assert created.json()["source"] == "simulated"
    captured = client.post(f"/donations/{created.json()['paypal_order_id']}/capture")
    assert captured.status_code == 200
    assert captured.json()["source"] == "simulated"
    ledger = client.get("/campaigns/1/ledger")
    assert ledger.status_code == 200
    assert ledger.json()[0]["source"] == "simulated"

    captured_again = client.post(f"/donations/{created.json()['paypal_order_id']}/capture")
    assert captured_again.status_code == 200
    assert captured_again.json()["status"] == "captured"
    assert client.get("/campaigns/1").json()["pool_balance"] == 10


def test_real_order_returns_sandbox_approval_link(client, monkeypatch):
    async def create_order(**kwargs):
        assert kwargs["campaign_id"] == 1
        return {"id": "ORDER-REDIRECT", "links": [
            {"rel": "approve", "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-REDIRECT"}
        ]}

    monkeypatch.setattr(type(main.paypal), "is_configured", property(lambda self: True))
    monkeypatch.setattr(main.paypal, "create_order", create_order)
    response = client.post("/campaigns/1/donations", json={"donor_name": "Donor", "amount": 10})
    assert response.status_code == 201
    assert response.json()["approval_url"] == "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-REDIRECT"


def test_open_orders_reserve_capacity_until_paypal_confirms_void(client, monkeypatch):
    orders = []
    order_status = {"ORDER-1": "CREATED"}

    async def create_order(**kwargs):
        order_id = f"ORDER-{len(orders) + 1}"
        orders.append(order_id)
        return {"id": order_id, "links": [{"rel": "approve",
                "href": f"https://www.sandbox.paypal.com/checkoutnow?token={order_id}"}]}

    async def get_order(order_id):
        return {"id": order_id, "status": order_status.get(order_id, "CREATED")}

    monkeypatch.setattr(type(main.paypal), "is_configured", property(lambda self: True))
    monkeypatch.setattr(main.paypal, "create_order", create_order)
    monkeypatch.setattr(main.paypal, "get_order", get_order)
    first = client.post("/campaigns/1/donations", json={"donor_name": "A", "amount": 80})
    assert first.status_code == 201
    assert client.get("/campaigns/1/availability").json()["remaining"] == 20
    blocked = client.post("/campaigns/1/donations", json={"donor_name": "B", "amount": 30})
    assert blocked.status_code == 409
    assert len(orders) == 1

    still_open = client.post("/donations/ORDER-1/release")
    assert still_open.json()["status"] == "created"
    assert client.get("/campaigns/1/availability").json()["reserved"] == 80
    order_status["ORDER-1"] = "VOIDED"
    released = client.post("/donations/ORDER-1/release")
    assert released.json()["status"] == "failed"
    assert client.get("/campaigns/1/availability").json()["remaining"] == 100
    assert client.post("/campaigns/1/donations", json={"donor_name": "B", "amount": 100}).status_code == 201


def test_capture_consumes_hold_and_paid_work_counts_toward_goal(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_simulated_donations", True)
    created = client.post("/campaigns/1/donations", json={"donor_name": "A", "amount": 60, "simulate": True})
    assert created.status_code == 201
    assert client.get("/campaigns/1/availability").json() == {
        "goal": 100, "status": "active", "raised": 0, "reserved": 60, "remaining": 40}
    captured = client.post(f"/donations/{created.json()['paypal_order_id']}/capture")
    assert captured.json()["status"] == "captured"
    assert client.get("/campaigns/1/availability").json()["remaining"] == 40

    with next(app.dependency_overrides[get_db]()) as db:
        db.add(BudgetLine(campaign_id=1, name="Work", budgeted_amount=40, paid_amount=30))
        db.query(Campaign).filter_by(id=1).one().pool_balance = 30
        db.commit()
    assert client.get("/campaigns/1/availability").json()["remaining"] == 40
    assert client.post("/campaigns/1/donations", json={"donor_name": "B", "amount": 40.01, "simulate": True}).status_code == 409


def test_failed_order_creation_and_expired_checkout_release_holds(client, monkeypatch):
    async def broken_order(**kwargs):
        raise main.PayPalError(503, {"error": "unavailable"})

    monkeypatch.setattr(type(main.paypal), "is_configured", property(lambda self: True))
    monkeypatch.setattr(main.paypal, "create_order", broken_order)
    assert client.post("/campaigns/1/donations", json={"donor_name": "A", "amount": 70}).status_code == 502
    assert client.get("/campaigns/1/availability").json()["remaining"] == 100

    async def create_order(**kwargs):
        return {"id": "ORDER-OLD", "links": [{"rel": "approve",
                "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-OLD"}]}

    async def get_order(order_id):
        return {"id": order_id, "status": "APPROVED"}

    monkeypatch.setattr(main.paypal, "create_order", create_order)
    monkeypatch.setattr(main.paypal, "get_order", get_order)
    assert client.post("/campaigns/1/donations", json={"donor_name": "A", "amount": 70}).status_code == 201
    with next(app.dependency_overrides[get_db]()) as db:
        db.query(Donation).filter_by(paypal_order_id="ORDER-OLD").one().created_at = (
            datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=8))
        db.commit()
    assert client.get("/campaigns/1/availability").json()["remaining"] == 100
    assert client.post("/donations/ORDER-OLD/capture").status_code == 409


def test_preexisting_order_cannot_capture_after_campaign_fills(client, monkeypatch):
    with next(app.dependency_overrides[get_db]()) as db:
        db.query(Campaign).filter_by(id=1).one().pool_balance = 90
        db.add(Donation(campaign_id=1, donor_name="Earlier donor", amount=20, currency="USD",
                        paypal_order_id="LEGACY-ORDER", status="created", capacity_reserved=False))
        db.commit()

    async def get_order(order_id):
        return {"id": order_id, "status": "APPROVED"}

    captures = []

    async def capture_order(order_id):
        captures.append(order_id)
        return {}

    monkeypatch.setattr(type(main.paypal), "is_configured", property(lambda self: True))
    monkeypatch.setattr(main.paypal, "get_order", get_order)
    monkeypatch.setattr(main.paypal, "capture_order", capture_order)
    response = client.post("/donations/LEGACY-ORDER/capture")
    assert response.status_code == 409
    assert captures == []
    assert client.get("/donations/LEGACY-ORDER/status").json()["status"] == "failed"


def test_invalid_checkout_link_is_rejected(client, monkeypatch):
    async def create_order(**kwargs):
        return {"id": "ORDER-UNSAFE", "links": [
            {"rel": "approve", "href": "https://example.com/checkout?token=ORDER-UNSAFE"}
        ]}

    monkeypatch.setattr(type(main.paypal), "is_configured", property(lambda self: True))
    monkeypatch.setattr(main.paypal, "create_order", create_order)
    response = client.post("/campaigns/1/donations", json={"donor_name": "Donor", "amount": 10})
    assert response.status_code == 502
    assert client.get("/campaigns/1").json()["pool_balance"] == 0


def test_previously_pending_order_captures_after_paypal_approval(client, monkeypatch):
    async def create_order(**kwargs):
        return {"id": "ORDER-PENDING", "links": [
            {"rel": "payer-action", "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PENDING"}
        ]}

    order_states = iter(["CREATED", "APPROVED"])

    async def get_order(order_id):
        assert order_id == "ORDER-PENDING"
        return {"id": order_id, "status": next(order_states)}

    calls = []

    async def capture_order(order_id):
        calls.append(order_id)
        return {"id": order_id, "status": "COMPLETED", "purchase_units": [{"payments": {"captures": [
            {"status": "COMPLETED", "amount": {"value": "10.00", "currency_code": "USD"}}
        ]}}]}

    monkeypatch.setattr(type(main.paypal), "is_configured", property(lambda self: True))
    monkeypatch.setattr(main.paypal, "create_order", create_order)
    monkeypatch.setattr(main.paypal, "get_order", get_order)
    monkeypatch.setattr(main.paypal, "capture_order", capture_order)
    created = client.post("/campaigns/1/donations", json={"donor_name": "Donor", "amount": 10})
    assert created.status_code == 201

    # A status check before approval can leave the donation pending.
    first = client.post("/donations/ORDER-PENDING/capture")
    assert first.status_code == 200
    assert first.json()["status"] == "pending"
    second = client.post("/donations/ORDER-PENDING/capture")
    assert second.status_code == 200
    assert second.json()["status"] == "captured"
    assert calls == ["ORDER-PENDING"]
    assert client.get("/campaigns/1").json()["pool_balance"] == 10


@pytest.mark.parametrize("action", ["approve", "reject", "retry"])
@pytest.mark.parametrize("headers", [{}, {"X-Verifier-Key": "wrong"}])
def test_verifier_endpoints_require_key(client, action: str, headers: dict):
    response = client.post(f"/invoices/999/{action}", json={"verifier_name": "Tester"}, headers=headers)
    assert response.status_code == 401


def test_verifier_account_passes_verifier_gate(client):
    with next(app.dependency_overrides[get_db]()) as db:
        db.add(User(id=99, email="reviewer@example.com", name="Reviewer", password_hash="fixture", role="verifier"))
        db.add(UserSession(user_id=99, token_hash=_digest("verifier-fixture"),
                           expires_at=_now() + timedelta(days=1)))
        db.commit()
    client.cookies.set(COOKIE_NAME, "verifier-fixture")
    response = client.post("/invoices/999/reject", json={"verifier_name": "Tester"})
    assert response.status_code == 404
