"""Keep donation availability in sync with refunds and dispute holds."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from sqlalchemy.orm import Session

import audit
from models import Campaign, Donation, PaymentAdjustment


def _money(value: object) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise HTTPException(422, "Invalid PayPal adjustment amount.") from exc
    if not result.is_finite() or result < 0:
        raise HTTPException(422, "Invalid PayPal adjustment amount.")
    return result


def _sync_balance(db: Session, donation: Donation) -> None:
    campaign = db.query(Campaign).filter_by(id=donation.campaign_id).with_for_update().populate_existing().one()
    donation = db.query(Donation).filter_by(id=donation.id).with_for_update().populate_existing().one()
    rows = db.query(PaymentAdjustment).filter_by(donation_id=donation.id).all()
    refunds = sum((_money(row.amount) for row in rows if row.kind == "refund" and row.status == "completed"), Decimal(0))
    holds = sum((_money(row.amount) for row in rows if row.kind == "dispute" and row.status in {"open", "buyer_favor"}), Decimal(0))
    unavailable = min(_money(donation.amount), refunds + holds)
    previous = _money(donation.unavailable_amount or 0)
    campaign.pool_balance = round(float(Decimal(str(campaign.pool_balance)) + previous - unavailable), 2)
    donation.unavailable_amount = float(unavailable)
    audit.log(db, actor="system", action="donation.availability_changed", campaign_id=campaign.id,
              detail={"donation_id": donation.id, "unavailable_amount": donation.unavailable_amount,
                      "pool_balance": campaign.pool_balance}, commit=False)
    db.commit()


def record_refund_total(db: Session, donation: Donation, amount: object, status: str, reference: str) -> PaymentAdjustment:
    if status != "completed":
        raise HTTPException(422, "Only confirmed refund totals affect the balance.")
    total = _money(amount)
    if total > _money(donation.amount):
        raise HTTPException(409, "PayPal refund exceeds the original donation.")
    row = db.query(PaymentAdjustment).filter_by(reference=reference).first()
    if row and (row.kind != "refund" or row.donation_id != donation.id):
        raise HTTPException(409, "Refund reference is already assigned elsewhere.")
    if row is None:
        row = PaymentAdjustment(donation_id=donation.id, kind="refund", reference=reference,
                                amount=float(total), status=status)
        db.add(row)
    else:
        row.amount = max(row.amount, float(total))
        row.status = "completed"
    db.flush()
    _sync_balance(db, donation)
    return row


def record_refund_request(db: Session, donation: Donation, amount: object, status: str) -> PaymentAdjustment:
    value = _money(amount)
    if status not in {"pending", "failed"} or value > _money(donation.amount):
        raise HTTPException(409, "Refund request could not be recorded.")
    reference = f"refund-request:{donation.id}"
    row = db.query(PaymentAdjustment).filter_by(reference=reference).first()
    if row is None:
        row = PaymentAdjustment(donation_id=donation.id, kind="refund", reference=reference,
                                amount=float(value), status=status)
        db.add(row)
    else:
        row.amount = float(value)
        row.status = status
    db.commit()
    return row


def record_dispute(db: Session, donation: Donation, details: dict) -> PaymentAdjustment:
    dispute_id = details.get("dispute_id")
    amount_info = details.get("dispute_amount") or {}
    if not dispute_id or amount_info.get("currency_code") != donation.currency:
        raise HTTPException(409, "Dispute ID or currency does not match the donation.")
    amount = _money(amount_info.get("value"))
    if amount > _money(donation.amount):
        raise HTTPException(409, "Dispute exceeds the original donation.")
    resolved = details.get("status") == "RESOLVED"
    outcome = (details.get("dispute_outcome") or {}).get("outcome_code")
    if resolved and outcome in {"RESOLVED_SELLER_FAVOUR", "CANCELED_BY_BUYER"}:
        status = "seller_favor"
    elif resolved and outcome in {"RESOLVED_BUYER_FAVOUR", "RESOLVED_WITH_PAYOUT", "ACCEPTED"}:
        status = "buyer_favor"
    elif resolved:
        raise HTTPException(409, "PayPal dispute is resolved with an unrecognized outcome.")
    else:
        status = "open"
    reference = f"dispute:{dispute_id}"
    row = db.query(PaymentAdjustment).filter_by(reference=reference).first()
    if row and (row.kind != "dispute" or row.donation_id != donation.id):
        raise HTTPException(409, "Dispute reference is already assigned elsewhere.")
    if row is None:
        row = PaymentAdjustment(donation_id=donation.id, kind="dispute", reference=reference,
                                amount=float(amount), status=status, detail=details.get("reason"))
        db.add(row)
    else:
        row.amount = float(amount)
        row.status = status
        row.detail = details.get("reason")
    db.flush()
    _sync_balance(db, donation)
    return row
