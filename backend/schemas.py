"""
schemas.py — Pydantic v2 request/response models for StraightMoney API.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from decimal import Decimal
import re

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer, StringConstraints, field_validator

from config import settings


def _cents(value: float) -> float:
    if Decimal(str(value)) != Decimal(str(value)).quantize(Decimal("0.01")):
        raise ValueError("Amounts must have at most two decimal places.")
    return value


def _email(value: str) -> str:
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise ValueError("A valid payout email is required.")
    return value


Money = Annotated[float, Field(gt=0, le=100_000_000, allow_inf_nan=False), AfterValidator(_cents)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Email = Annotated[str, StringConstraints(strip_whitespace=True, max_length=254), AfterValidator(_email)]
Currency = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^USD$")]
UTCDateTime = Annotated[datetime, PlainSerializer(
    lambda value: (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value).isoformat(),
    return_type=str, when_used="json")]


# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------


class VendorCreate(BaseModel):
    """Fields required to create a vendor inside a campaign."""

    name: Name
    payout_email: Email


class VendorOut(BaseModel):
    """Vendor as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    name: str
    payout_email: str
    status: str
    created_at: UTCDateTime


# ---------------------------------------------------------------------------
# Budget Lines
# ---------------------------------------------------------------------------


class BudgetLineCreate(BaseModel):
    """Fields required to create a budget line inside a campaign."""

    name: Name
    vendor_id: Optional[int] = None
    budgeted_amount: Money
    vendor_name: Optional[Name] = None
    vendor_payout_email: Optional[Email] = None


class BudgetLineOut(BaseModel):
    """Budget line as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    name: str
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    budgeted_amount: float
    paid_amount: float
    created_at: UTCDateTime


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------


class CampaignCreate(BaseModel):
    """Full campaign creation payload including nested vendors and budget lines."""

    title: Name
    description: Optional[str] = Field(default=None, max_length=10000)
    goal_amount: Money
    currency: Currency = "USD"
    organizer_name: Name
    vendors: list[VendorCreate] = Field(default_factory=list, max_length=100)
    budget_lines: list[BudgetLineCreate] = Field(default_factory=list, max_length=100)


class CampaignOut(BaseModel):
    """Summarised campaign response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    goal_amount: float
    currency: str
    pool_balance: float
    status: str
    organizer_name: str
    created_at: UTCDateTime


class CampaignDetail(CampaignOut):
    """Full campaign detail including nested collections."""

    model_config = ConfigDict(from_attributes=True)

    vendors: list[VendorOut] = []
    budget_lines: list[BudgetLineOut] = []


# ---------------------------------------------------------------------------
# Donations
# ---------------------------------------------------------------------------


class DonationCreate(BaseModel):
    """Payload to initiate a donation (creates a PayPal order)."""

    donor_name: Name
    amount: Money
    simulate: bool = False

    @field_validator("amount")
    @classmethod
    def check_maximum(cls, value: float) -> float:
        if value > settings.max_donation_amount:
            raise ValueError(f"Donation amount cannot exceed {settings.max_donation_amount:g}.")
        return value


class DonationOut(BaseModel):
    """Donation record as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    donor_name: str
    amount: float
    currency: str
    paypal_order_id: str
    status: str
    source: str
    paypal_capture_status: Optional[str] = None
    created_at: UTCDateTime


class DonationCreateOut(DonationOut):
    """New order with the Sandbox URL where the donor approves payment."""

    approval_url: Optional[str] = None


class DonationCaptureOut(DonationOut):
    """Extends DonationOut with PayPal capture details."""

    paypal_capture_details: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


class CheckResult(BaseModel):
    """Result of a single policy or AI check."""

    check_name: str
    passed: bool
    severity: str  # "hard" | "soft"
    source: str  # "rule" | "ai"
    detail: str


class CheckOut(BaseModel):
    """Check row as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    check_name: str
    passed: bool
    severity: str
    source: str
    detail: str
    created_at: UTCDateTime


# ---------------------------------------------------------------------------
# Verifications
# ---------------------------------------------------------------------------


class VerificationCreate(BaseModel):
    """Human verifier decision payload."""

    verifier_name: Name
    note: Optional[str] = Field(default=None, max_length=5000)
    override_for_testing: bool = False


class VerificationOut(BaseModel):
    """Verification record as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    verifier_name: str
    decision: str
    note: Optional[str]
    timestamp: UTCDateTime


# ---------------------------------------------------------------------------
# Payouts
# ---------------------------------------------------------------------------


class PayoutOut(BaseModel):
    """Payout record as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    paypal_batch_id: Optional[str]
    sender_batch_id: Optional[str]
    status: str
    amount: float
    currency: str
    created_at: UTCDateTime


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


class PayoutInstallmentOut(PayoutOut):
    pass


class InvoiceOut(BaseModel):
    """Summarised invoice as returned in list responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    budget_line_id: int
    vendor_id: int
    invoice_number: str
    amount: float
    currency: str
    payout_email: str
    description: Optional[str] = None
    evidence_path: Optional[str] = None
    raw_file_path: Optional[str] = None
    vendor_name: Optional[str] = None
    budget_line_name: Optional[str] = None
    status: str
    ai_summary: Optional[str] = None
    paid_amount: float = 0.0
    remaining_amount: float = 0.0
    created_at: UTCDateTime


class InvoiceDetail(InvoiceOut):
    """Full invoice detail including checks, verifications, and payout."""

    model_config = ConfigDict(from_attributes=True)

    checks: list[CheckOut] = []
    verifications: list[VerificationOut] = []
    payout: Optional[PayoutOut] = None
    installments: list[PayoutInstallmentOut] = []


# ---------------------------------------------------------------------------
# Ledger
# ---------------------------------------------------------------------------


class LedgerEntry(BaseModel):
    """A single entry in the public campaign ledger (donation or payout)."""

    type: str  # "donation" | "payout"
    amount: float
    actor_name: str
    status: str
    source: Optional[str] = None
    created_at: UTCDateTime
    proof_url: Optional[str] = None


# ---------------------------------------------------------------------------
# LLM result shapes
# ---------------------------------------------------------------------------


class LineItem(BaseModel):
    """A single line item extracted from an invoice."""

    description: str
    amount: Annotated[float, Field(ge=0, le=100_000_000, allow_inf_nan=False), AfterValidator(_cents)]


class ExtractionResult(BaseModel):
    """Structured data extracted from an invoice file by the LLM."""

    vendor_name: Name
    payout_email: Email
    invoice_number: Name
    amount: Money
    currency: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Z]{3}$")]
    description: str
    line_items: list[LineItem] = []


class AdvisoryResult(BaseModel):
    """Soft advisory flags generated by the LLM for an invoice."""

    flags: list[str]
    summary: str
