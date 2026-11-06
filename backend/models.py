"""
models.py — SQLAlchemy ORM models for all 10 StraightMoney database tables.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from db import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Campaign(Base):
    """Top-level fundraising campaign."""

    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    goal_amount = Column(Float, nullable=False)
    currency = Column(String, default="USD", nullable=False)
    pool_balance = Column(Float, default=0.0, nullable=False)
    status = Column(String, default="draft", nullable=False)  # draft | active | closed
    organizer_name = Column(String, nullable=False)
    organizer_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    vendors = relationship("Vendor", back_populates="campaign", cascade="all, delete-orphan")
    budget_lines = relationship("BudgetLine", back_populates="campaign", cascade="all, delete-orphan")
    donations = relationship("Donation", back_populates="campaign", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="campaign", cascade="all, delete-orphan")


class Vendor(Base):
    """Payee who can receive payouts for a campaign."""

    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    payout_email = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String, default="active", nullable=False)  # active | inactive
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="vendors")
    budget_lines = relationship("BudgetLine", back_populates="vendor")
    invoices = relationship("Invoice", back_populates="vendor")


class BudgetLine(Base):
    """A spending category within a campaign with a budgeted ceiling."""

    __tablename__ = "budget_lines"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True, index=True)
    budgeted_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="budget_lines")
    vendor = relationship("Vendor", back_populates="budget_lines")
    invoices = relationship("Invoice", back_populates="budget_line")

    @property
    def vendor_name(self) -> str | None:
        return self.vendor.name if self.vendor else None


class Donation(Base):
    """A donor contribution captured through PayPal."""

    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    donor_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    paypal_order_id = Column(String, unique=True, nullable=False, index=True)
    source = Column(String, default="paypal", nullable=False)  # paypal | simulated
    status = Column(String, default="created", nullable=False)  # created | pending | captured | failed
    paypal_capture_status = Column(String, nullable=True)
    paypal_capture_id = Column(String(100), nullable=True, index=True)
    refund_request_id = Column(String(100), nullable=True)
    refund_start_amount = Column(Float, default=0.0, nullable=False)
    refund_processed = Column(Boolean, default=False, nullable=False)
    unavailable_amount = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="donations")
    adjustments = relationship("PaymentAdjustment", back_populates="donation", cascade="all, delete-orphan")

    @property
    def refund_requested(self) -> bool:
        return self.refund_request_id is not None


class Invoice(Base):
    """A vendor invoice submitted for approval and payout."""

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    budget_line_id = Column(Integer, ForeignKey("budget_lines.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    invoice_number = Column(String, nullable=False)
    document_hash = Column(String(64), nullable=True, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    payout_email = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    extracted_json = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    raw_file_path = Column(String, nullable=True)
    evidence_path = Column(String, nullable=True)
    status = Column(
        String,
        default="SUBMITTED",
        nullable=False,
    )  # SUBMITTED | EXTRACTED | CHECKED | AWAITING_VERIFIER | REJECTED | VERIFIER_REJECTED | PAYOUT_PENDING | PAID | FAILED
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="invoices")
    budget_line = relationship("BudgetLine", back_populates="invoices")
    vendor = relationship("Vendor", back_populates="invoices")
    files = relationship("StoredFile", back_populates="invoice", cascade="all, delete-orphan")
    checks = relationship("Check", back_populates="invoice", cascade="all, delete-orphan")
    verifications = relationship("Verification", back_populates="invoice", cascade="all, delete-orphan")
    payout = relationship("Payout", back_populates="invoice", uselist=False, cascade="all, delete-orphan")
    installments = relationship("PayoutInstallment", back_populates="invoice", cascade="all, delete-orphan")
    delivery = relationship("DeliveryCloseout", back_populates="invoice", uselist=False, cascade="all, delete-orphan")

    @property
    def paid_amount(self) -> float:
        legacy = self.payout.amount if self.payout and self.payout.status == "success" else 0.0
        return round(legacy + sum(part.amount for part in self.installments if part.status == "success"), 2)

    @property
    def remaining_amount(self) -> float:
        return max(0.0, round(self.amount - self.paid_amount, 2))

    @property
    def vendor_name(self) -> str | None:
        return self.vendor.name if self.vendor else None

    @property
    def budget_line_name(self) -> str | None:
        return self.budget_line.name if self.budget_line else None


class StoredFile(Base):
    """Invoice or proof bytes held in PostgreSQL (BYTEA)."""

    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)  # invoice | proof
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    data = Column(LargeBinary, nullable=False)

    invoice = relationship("Invoice", back_populates="files")


class Check(Base):
    """An individual policy or AI check result attached to an invoice."""

    __tablename__ = "checks"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    check_name = Column(String, nullable=False)
    passed = Column(Boolean, nullable=False)
    severity = Column(String, nullable=False)  # hard | soft
    source = Column(String, nullable=False)  # rule | ai
    detail = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="checks")


class Verification(Base):
    """A human verifier decision on an invoice."""

    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    verifier_name = Column(String, nullable=False)
    decision = Column(String, nullable=False)  # approve | reject
    note = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="verifications")


class Payout(Base):
    """PayPal payout record linked to an approved invoice."""

    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, unique=True)
    paypal_batch_id = Column(String, nullable=True)
    sender_batch_id = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)  # pending | success | failed
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="payout")


class PayoutInstallment(Base):
    """One independently tracked PayPal transfer toward an approved invoice."""

    __tablename__ = "payout_installments"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    paypal_batch_id = Column(String, nullable=True, unique=True)
    sender_batch_id = Column(String, nullable=False, unique=True)
    status = Column(String, nullable=False, default="pending")
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    invoice = relationship("Invoice", back_populates="installments")


class AuditLog(Base):
    """Immutable record of every significant state change in the system."""

    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=_utcnow, nullable=False, index=True)
    campaign_id = Column(Integer, nullable=True, index=True)
    invoice_id = Column(Integer, nullable=True, index=True)
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False, index=True)
    detail = Column(Text, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(254), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False)  # organizer | vendor | verifier
    created_at = Column(DateTime, default=_utcnow, nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)


class VendorInvite(Base):
    __tablename__ = "vendor_invites"

    id = Column(Integer, primary_key=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String(100), primary_key=True)
    event_type = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False)
    received_at = Column(DateTime, default=_utcnow, nullable=False)


class ReconciliationIssue(Base):
    __tablename__ = "reconciliation_issues"

    id = Column(Integer, primary_key=True)
    event_id = Column(String(100), nullable=False, index=True)
    campaign_id = Column(Integer, nullable=True, index=True)
    reference = Column(String(100), nullable=True)
    detail = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)


class DeliveryCloseout(Base):
    __tablename__ = "delivery_closeouts"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), unique=True, nullable=False)
    delivered_description = Column(Text, nullable=False)
    delivered_at = Column(DateTime, nullable=False)
    reported_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    accepted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remaining_issue = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="reported")
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    invoice = relationship("Invoice", back_populates="delivery")


class PaymentAdjustment(Base):
    __tablename__ = "payment_adjustments"

    id = Column(Integer, primary_key=True)
    donation_id = Column(Integer, ForeignKey("donations.id"), nullable=False, index=True)
    kind = Column(String(20), nullable=False)  # refund | dispute
    reference = Column(String(150), unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(40), nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    donation = relationship("Donation", back_populates="adjustments")
