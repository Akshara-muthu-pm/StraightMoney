from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import pytest

from db import Base
from main import _paypal_capture_status, _store_capture_result
from models import Campaign, Donation


def _response(status: str, order_status: str = "COMPLETED") -> dict:
    return {
        "id": "ORDER-1",
        "status": order_status,
        "purchase_units": [{"payments": {"captures": [{"status": status, "amount": {"value": "25.00", "currency_code": "USD"}}]}}],
    }


def _donation() -> tuple[Session, Campaign, Donation]:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = Session(engine)
    campaign = Campaign(title="Test", goal_amount=100, currency="USD", pool_balance=0,
                        status="active", organizer_name="Organizer")
    db.add(campaign)
    db.flush()
    donation = Donation(campaign_id=campaign.id, donor_name="Donor", amount=25,
                        currency="USD", paypal_order_id="ORDER-1", status="created")
    db.add(donation)
    db.commit()
    return db, campaign, donation


def test_only_capture_status_controls_credit_and_duplicate_is_idempotent():
    db, campaign, donation = _donation()
    try:
        result, _, credited = _store_capture_result(db, donation.paypal_order_id, _response("PENDING"))
        assert not credited
        assert result.status == "pending"
        assert result.paypal_capture_status == "PENDING"
        assert campaign.pool_balance == 0

        result, _, credited = _store_capture_result(db, donation.paypal_order_id, _response("COMPLETED"))
        assert credited
        assert result.status == "captured"
        assert result.paypal_capture_status == "COMPLETED"
        assert campaign.pool_balance == 25

        _, _, credited = _store_capture_result(db, donation.paypal_order_id, _response("COMPLETED"))
        assert not credited
        assert campaign.pool_balance == 25
    finally:
        db.close()


@pytest.mark.parametrize("status", ["DECLINED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"])
def test_other_status_fails_and_preserves_paypal_value(status: str):
    db, campaign, donation = _donation()
    try:
        result, _, credited = _store_capture_result(db, donation.paypal_order_id, _response(status))
        assert not credited
        assert result.status == "failed"
        assert result.paypal_capture_status == status
        assert campaign.pool_balance == 0
    finally:
        db.close()


def test_order_status_alone_cannot_credit_a_donation():
    assert _paypal_capture_status({"status": "COMPLETED"}) == "UNKNOWN"
    db, campaign, donation = _donation()
    try:
        result, _, credited = _store_capture_result(db, donation.paypal_order_id, {"status": "COMPLETED"})
        assert not credited
        assert result.status == "pending"
        assert result.paypal_capture_status == "UNKNOWN"
        assert campaign.pool_balance == 0
    finally:
        db.close()
