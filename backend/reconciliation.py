"""Verified PayPal notifications reconcile existing orders and payout reservations."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from sqlalchemy.orm import Session

from installments import _apply_status, pay_campaign
from finance import record_dispute, record_refund_request, record_refund_total
from models import Donation, PaymentAdjustment, PayoutInstallment, ReconciliationIssue, WebhookEvent
from payments import PayPalClient, PayPalError


def _flag(db: Session, record: WebhookEvent, reference: str | None, detail: str,
          campaign_id: int | None = None) -> str:
    record.status = "flagged"
    db.add(ReconciliationIssue(event_id=record.id, reference=reference,
                               campaign_id=campaign_id, detail=detail))
    db.commit()
    return "flagged"


def _capture_in_order(order: dict) -> dict | None:
    try:
        return order["purchase_units"][0]["payments"]["captures"][0]
    except (KeyError, IndexError, TypeError):
        return None


async def _capture(db: Session, record: WebhookEvent, event: dict, paypal: PayPalClient) -> str:
    from main import _store_capture_result

    resource = event.get("resource") or {}
    order_id = ((resource.get("supplementary_data") or {}).get("related_ids") or {}).get("order_id")
    if not isinstance(order_id, str) or not order_id:
        return _flag(db, record, None, "Capture notification has no order ID.")
    donation = db.query(Donation).filter_by(paypal_order_id=order_id).first()
    if donation is None or donation.source != "paypal":
        return _flag(db, record, order_id, "No matching PayPal donation was recorded.")
    order = await paypal.get_order(order_id)
    capture = _capture_in_order(order)
    if order.get("id") != order_id or capture is None:
        return _flag(db, record, order_id, "PayPal order or capture details do not match.", donation.campaign_id)
    if resource.get("id") and resource["id"] != capture.get("id"):
        return _flag(db, record, order_id, "Capture ID differs from the current PayPal order.", donation.campaign_id)
    try:
        matches = (Decimal(capture["amount"]["value"]) == Decimal(str(donation.amount))
                   and capture["amount"]["currency_code"] == donation.currency)
    except (KeyError, InvalidOperation, TypeError):
        matches = False
    if not matches:
        return _flag(db, record, order_id, "PayPal capture amount or currency differs from the local donation.", donation.campaign_id)
    if capture.get("status") in {"PARTIALLY_REFUNDED", "REFUNDED"}:
        return await _refund(db, record, event, paypal)
    if donation.status == "captured" and capture.get("status") != "COMPLETED":
        return _flag(db, record, order_id, "PayPal capture changed after local funds were credited; review refund or dispute.", donation.campaign_id)
    if event["event_type"] == "PAYMENT.CAPTURE.COMPLETED" and capture.get("status") != "COMPLETED":
        return _flag(db, record, order_id, "Completion notification disagrees with current PayPal capture status.", donation.campaign_id)
    try:
        updated, campaign, credited = _store_capture_result(db, order_id, order)
    except HTTPException:
        db.rollback()
        return _flag(db, record, order_id, "PayPal capture amount, currency or order did not match the local donation.", donation.campaign_id)
    if credited and campaign:
        try:
            await pay_campaign(db, campaign.id, paypal)
        except PayPalError:
            db.rollback()  # Capture remains committed; the payout queue can be retried.
    record.status = "processed"
    db.commit()
    return "processed"


async def _refund(db: Session, record: WebhookEvent, event: dict, paypal: PayPalClient) -> str:
    resource = event.get("resource") or {}
    capture_id = resource.get("id")
    order_id = ((resource.get("supplementary_data") or {}).get("related_ids") or {}).get("order_id")
    donation = db.query(Donation).filter_by(paypal_capture_id=capture_id).first() if capture_id else None
    if donation is None and order_id:
        donation = db.query(Donation).filter_by(paypal_order_id=order_id).first()
    if donation is None or donation.source != "paypal" or donation.status != "captured" or not capture_id:
        return _flag(db, record, str(capture_id or order_id or ""), "Refund has no matching PayPal donation.")
    capture = await paypal.get_capture(capture_id)
    amount = (capture.get("seller_receivable_breakdown") or {}).get("total_refunded_amount") or {}
    if capture.get("id") != capture_id or (donation.paypal_capture_id and donation.paypal_capture_id != capture_id):
        return _flag(db, record, capture_id, "Refund capture ID does not match the donation.", donation.campaign_id)
    if not amount.get("value") and capture.get("status") == "REFUNDED":
        amount = {"value": str(donation.amount), "currency_code": donation.currency}
    if amount.get("currency_code") != donation.currency or capture.get("status") not in {"PARTIALLY_REFUNDED", "REFUNDED"}:
        return _flag(db, record, capture_id, "PayPal capture does not confirm a refund in the donation currency.", donation.campaign_id)
    try:
        donation.paypal_capture_id = capture_id
        record_refund_total(db, donation, amount["value"], "completed", f"capture:{capture_id}")
        db.query(PaymentAdjustment).filter_by(reference=f"refund-request:{donation.id}").delete()
        if donation.refund_request_id and Decimal(str(amount["value"])) >= Decimal(str(donation.amount)):
            donation.refund_processed = True
    except (HTTPException, KeyError):
        db.rollback()
        return _flag(db, record, capture_id, "PayPal refund total conflicts with the original donation.", donation.campaign_id)
    record.status = "processed"
    db.commit()
    return "processed"


async def _refund_status(db: Session, record: WebhookEvent, event: dict, paypal: PayPalClient) -> str:
    refund_id = (event.get("resource") or {}).get("id")
    if not refund_id:
        return _flag(db, record, None, "Refund status event has no refund ID.")
    refund = await paypal.get_refund(refund_id)
    up_link = next((link.get("href", "") for link in refund.get("links", []) if link.get("rel") == "up"), "")
    capture_id = up_link.rstrip("/").split("/v2/payments/captures/")[-1] if "/v2/payments/captures/" in up_link else None
    donation = db.query(Donation).filter_by(paypal_capture_id=capture_id).first() if capture_id else None
    if refund.get("id") != refund_id or donation is None or donation.source != "paypal":
        return _flag(db, record, refund_id, "Refund status does not match a recorded PayPal capture.")
    status = refund.get("status")
    if status not in {"PENDING", "FAILED"} or (refund.get("amount") or {}).get("currency_code") != donation.currency:
        return _flag(db, record, refund_id, "PayPal refund status or currency could not be confirmed.", donation.campaign_id)
    amount = (refund.get("amount") or {}).get("value")
    try:
        record_refund_request(db, donation, amount, status.lower())
    except (HTTPException, InvalidOperation, TypeError):
        db.rollback()
        return _flag(db, record, refund_id, "Refund amount conflicts with the original donation.", donation.campaign_id)
    if status == "FAILED" and not donation.refund_processed:
        donation.refund_request_id = None
        donation.refund_start_amount = 0.0
    record.status = "processed"
    db.commit()
    return "processed"


async def _dispute(db: Session, record: WebhookEvent, event: dict, paypal: PayPalClient) -> str:
    dispute_id = (event.get("resource") or {}).get("dispute_id")
    if not dispute_id:
        return _flag(db, record, None, "Dispute notification has no dispute ID.")
    details = await paypal.get_dispute(dispute_id)
    transactions = details.get("disputed_transactions") or []
    if len(transactions) != 1:
        return _flag(db, record, dispute_id, "Dispute does not identify exactly one captured donation.")
    capture_id = transactions[0].get("seller_transaction_id")
    donation = db.query(Donation).filter_by(paypal_capture_id=capture_id).first() if capture_id else None
    if details.get("dispute_id") != dispute_id or donation is None or donation.source != "paypal":
        return _flag(db, record, str(capture_id or dispute_id), "Dispute does not match a recorded PayPal capture.")
    try:
        record_dispute(db, donation, details)
    except HTTPException:
        db.rollback()
        return _flag(db, record, dispute_id, "Dispute amount, currency or outcome could not be reconciled.", donation.campaign_id)
    record.status = "processed"
    db.commit()
    return "processed"


def _matching_payout_item(response: dict, part: PayoutInstallment) -> dict | None:
    return next((item for item in response.get("items", [])
                 if (item.get("payout_item") or {}).get("sender_item_id") in {part.sender_batch_id, str(part.id)}), None)


async def _payout(db: Session, record: WebhookEvent, event: dict, paypal: PayPalClient) -> str:
    resource = event.get("resource") or {}
    sender_id = (resource.get("payout_item") or {}).get("sender_item_id")
    batch_id = resource.get("payout_batch_id") or (resource.get("batch_header") or {}).get("payout_batch_id")
    part = None
    if sender_id:
        part = db.query(PayoutInstallment).filter_by(sender_batch_id=sender_id).first()
    if part is None and batch_id:
        part = db.query(PayoutInstallment).filter_by(paypal_batch_id=batch_id).first()
    if part is None:
        return _flag(db, record, str(batch_id or sender_id or ""), "No matching payout installment was recorded.")
    if not batch_id:
        batch_id = part.paypal_batch_id
    if not batch_id or (part.paypal_batch_id and batch_id != part.paypal_batch_id):
        return _flag(db, record, str(batch_id or sender_id or ""), "Payout batch ID is missing or does not match.", part.invoice.campaign_id)
    response = await paypal.get_payout_status(batch_id)
    item = _matching_payout_item(response, part)
    if item is None:
        return _flag(db, record, batch_id, "PayPal batch does not contain this installment.", part.invoice.campaign_id)
    payout_item = item.get("payout_item") or {}
    amount = payout_item.get("amount") or {}
    try:
        matches = (Decimal(amount["value"]) == Decimal(str(part.amount))
                   and amount["currency"] == part.currency
                   and payout_item["receiver"].casefold() == part.invoice.vendor.payout_email.casefold())
    except (KeyError, InvalidOperation, AttributeError, TypeError):
        matches = False
    if not matches:
        return _flag(db, record, batch_id, "PayPal payout amount, currency or recipient differs from the reservation.", part.invoice.campaign_id)
    provider_status = item.get("transaction_status")
    if (part.status == "success" and provider_status != "SUCCESS") or (part.status == "failed" and provider_status == "SUCCESS"):
        return _flag(db, record, batch_id, "PayPal payout status conflicts with settled local accounting.", part.invoice.campaign_id)
    _apply_status(db, part, {"batch_header": response.get("batch_header", {}), "items": [item]})
    record.status = "processed"
    db.commit()
    return "processed"


async def process_webhook(db: Session, event: dict, paypal: PayPalClient) -> str:
    event_id = event.get("id")
    event_type = event.get("event_type")
    if not isinstance(event_id, str) or not (1 <= len(event_id) <= 100) or not isinstance(event_type, str):
        raise ValueError("Invalid webhook event envelope.")
    record = db.get(WebhookEvent, event_id)
    if record and record.status != "pending":
        return record.status
    if record is None:
        record = WebhookEvent(id=event_id, event_type=event_type, status="pending")
        db.add(record)
        db.commit()
    if event_type in {"PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"}:
        return await _refund(db, record, event, paypal)
    if event_type in {"PAYMENT.REFUND.PENDING", "PAYMENT.REFUND.FAILED"}:
        return await _refund_status(db, record, event, paypal)
    if event_type.startswith("CUSTOMER.DISPUTE."):
        return await _dispute(db, record, event, paypal)
    if event_type.startswith("PAYMENT.CAPTURE."):
        return await _capture(db, record, event, paypal)
    if event_type.startswith("PAYMENT.PAYOUTS-ITEM."):
        return await _payout(db, record, event, paypal)
    record.status = "ignored"
    db.commit()
    return "ignored"
