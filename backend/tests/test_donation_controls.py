import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from config import settings
from db import Base, get_db
from main import app
from models import Campaign
from schemas import DonationCreate


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


@pytest.mark.parametrize("action", ["approve", "reject", "retry"])
@pytest.mark.parametrize("headers", [{}, {"X-Verifier-Key": "wrong"}])
def test_verifier_endpoints_require_key(client, action: str, headers: dict):
    response = client.post(f"/invoices/999/{action}", json={"verifier_name": "Tester"}, headers=headers)
    assert response.status_code == 401


def test_test_override_requires_key(client):
    response = client.post("/invoices/999/approve", json={"verifier_name": "Tester", "override_for_testing": True})
    assert response.status_code == 401


def test_valid_key_passes_verifier_gate(client):
    response = client.post("/invoices/999/reject", json={"verifier_name": "Tester"},
                           headers={"X-Verifier-Key": "test-verifier-key"})
    assert response.status_code == 404
