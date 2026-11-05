"""Ledger questions must use only the selected campaign's public records."""
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import advisory
import main
from db import Base
from models import BudgetLine, Campaign, Donation, Invoice, PayoutInstallment, Vendor
from schemas import LedgerQuestion


def test_question_length_is_bounded():
    with pytest.raises(ValidationError):
        LedgerQuestion(question=" ")
    with pytest.raises(ValidationError):
        LedgerQuestion(question="x" * 501)


@pytest.mark.asyncio
async def test_ledger_question_uses_only_selected_campaign_and_confirmed_payouts(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            for campaign_id in (1, 2):
                db.add(Campaign(id=campaign_id, title=f"Campaign {campaign_id}", goal_amount=1000,
                                currency="USD", pool_balance=100, status="active", organizer_name="O"))
            db.flush()
            for campaign_id in (1, 2):
                db.add(Vendor(id=campaign_id, campaign_id=campaign_id, name=f"Vendor {campaign_id}",
                              payout_email=f"v{campaign_id}@example.com", status="active"))
            db.flush()
            for campaign_id in (1, 2):
                db.add(BudgetLine(id=campaign_id, campaign_id=campaign_id, name="Books",
                                  vendor_id=campaign_id, budgeted_amount=1000, paid_amount=0))
            db.flush()
            for campaign_id in (1, 2):
                db.add(Invoice(id=campaign_id, campaign_id=campaign_id, budget_line_id=campaign_id,
                               vendor_id=campaign_id, invoice_number=f"INV-{campaign_id}", amount=100,
                               currency="USD", payout_email=f"v{campaign_id}@example.com", status="PAID"))
            db.flush()
            now = datetime.now(timezone.utc)
            db.add_all([
                PayoutInstallment(invoice_id=1, amount=50, currency="USD", sender_batch_id="BATCH-1",
                                  status="success", created_at=now),
                PayoutInstallment(invoice_id=1, amount=25, currency="USD", sender_batch_id="BATCH-2",
                                  status="pending", created_at=now),
                PayoutInstallment(invoice_id=2, amount=90, currency="USD", sender_batch_id="BATCH-3",
                                  status="success", created_at=now),
                Donation(campaign_id=1, donor_name="Donor", amount=30, currency="USD",
                         paypal_order_id="SIM-1", source="simulated", status="captured"),
            ])
            db.commit()

            ask = AsyncMock(return_value="Vendor 1 received $50.00.")
            monkeypatch.setattr(main.advisory_module, "answer_ledger_question", ask)
            result = await main.ask_ledger(1, LedgerQuestion(question="Which vendor got paid?"), db)
            assert result.answer == "Vendor 1 received $50.00."
            snapshot = ask.await_args.args[1]
            assert sorted((row["type"], row["actor_name"], row["amount"]) for row in snapshot) == [
                ("donation", "Donor", 30.0), ("payout", "Vendor 1", 50.0)
            ]
            assert all("proof_url" not in row for row in snapshot)
            with pytest.raises(HTTPException) as missing:
                await main.ask_ledger(999, LedgerQuestion(question="Who was paid?"), db)
            assert missing.value.status_code == 404
    finally:
        engine.dispose()


@pytest.mark.asyncio
async def test_gemini_receives_ledger_json_and_cannot_return_empty(monkeypatch):
    monkeypatch.setattr(advisory.settings, "llm_api_key", "test-key")
    generate = AsyncMock(return_value="Vendor A was paid $50.00.")
    monkeypatch.setattr(advisory, "_call_gemini_text", generate)
    answer = await advisory.answer_ledger_question("Which vendor got paid?", [
        {"type": "payout", "actor_name": "Vendor A", "amount": 50, "status": "success"}
    ], "USD")
    assert answer == "Vendor A was paid $50.00."
    prompt = generate.await_args.args[0]
    assert '"actor_name": "Vendor A"' in prompt
    assert "only when type is payout and status is success" in prompt
