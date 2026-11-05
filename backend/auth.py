"""Password-backed roles and server-side sessions for campaign workspaces."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session
from typing import Annotated

from config import settings
from db import get_db
from models import Campaign, ReconciliationIssue, User, UserSession, Vendor, VendorInvite
from schemas import CampaignOut, Email, Name

router = APIRouter(prefix="/auth", tags=["Accounts"])
COOKIE_NAME = "straightmoney_session"
SESSION_DAYS = 7


class Credentials(BaseModel):
    email: Email
    password: Annotated[str, StringConstraints(min_length=12, max_length=128)]


class Registration(Credentials):
    name: Name


class VendorRegistration(Registration):
    invite_token: str = Field(min_length=32, max_length=200)


class VerifierRegistration(Registration):
    bootstrap_key: str = Field(min_length=1)


class InviteAcceptance(BaseModel):
    invite_token: str = Field(min_length=32, max_length=200)


class LegacyClaim(BaseModel):
    setup_key: str = Field(min_length=1)


class AccountOut(BaseModel):
    id: int
    email: str
    name: str
    role: str


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return f"pbkdf2_sha256$600000${salt.hex()}${digest.hex()}"


def _password_matches(password: str, stored: str) -> bool:
    try:
        _, rounds, salt, expected = stored.split("$", 3)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(actual, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False


def _account(user: User) -> AccountOut:
    return AccountOut(id=user.id, email=user.email, name=user.name, role=user.role)


def _new_user(db: Session, payload: Registration, role: str) -> User:
    email = payload.email.strip().casefold()
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(409, "An account already exists for this email.")
    user = User(email=email, name=payload.name, password_hash=_password_hash(payload.password), role=role)
    db.add(user)
    db.flush()
    return user


def _start_session(db: Session, response: Response, user: User) -> AccountOut:
    token = secrets.token_urlsafe(32)
    db.add(UserSession(user_id=user.id, token_hash=_digest(token), expires_at=_now() + timedelta(days=SESSION_DAYS)))
    db.commit()
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_DAYS * 86400,
                        httponly=True, secure=settings.frontend_url.startswith("https://"),
                        samesite="strict", path="/")
    return _account(user)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") != settings.frontend_url.rstrip("/"):
            raise HTTPException(403, "Request origin is not allowed.")
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Sign in to continue.")
    session = db.query(UserSession).filter_by(token_hash=_digest(token)).first()
    if session is None or session.expires_at <= _now():
        raise HTTPException(401, "Your session has expired. Sign in again.")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(401, "Account not found.")
    return user


def _require_role(role: str):
    def dependency(request: Request, user: User = Depends(current_user)) -> None:
        if user.role != role:
            raise HTTPException(403, f"{role.title()} account required.")
        request.state.actor = user
    return dependency


require_organizer = _require_role("organizer")
require_vendor = _require_role("vendor")
require_verifier = _require_role("verifier")


@router.post("/register-organizer", response_model=AccountOut, status_code=201)
def register_organizer(payload: Registration, response: Response, db: Session = Depends(get_db)):
    user = _new_user(db, payload, "organizer")
    return _start_session(db, response, user)


@router.post("/register-vendor", response_model=AccountOut, status_code=201)
def register_vendor(payload: VendorRegistration, response: Response, db: Session = Depends(get_db)):
    invite, vendor = _valid_invite(db, payload.invite_token, payload.email)
    user = _new_user(db, payload, "vendor")
    vendor.user_id = user.id
    invite.used_at = _now()
    return _start_session(db, response, user)


def _valid_invite(db: Session, token: str, email: str) -> tuple[VendorInvite, Vendor]:
    invite = db.query(VendorInvite).filter_by(token_hash=_digest(token)).with_for_update().first()
    if invite is None or invite.used_at is not None or invite.expires_at <= _now():
        raise HTTPException(403, "Invitation is invalid or expired.")
    vendor = db.get(Vendor, invite.vendor_id)
    if vendor is None or vendor.user_id is not None or vendor.payout_email.casefold() != email.casefold():
        raise HTTPException(403, "Invitation does not match this vendor email.")
    return invite, vendor


@router.post("/accept-vendor-invite")
def accept_vendor_invite(payload: InviteAcceptance, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != "vendor":
        raise HTTPException(403, "Vendor account required.")
    invite, vendor = _valid_invite(db, payload.invite_token, user.email)
    vendor.user_id = user.id
    invite.used_at = _now()
    db.commit()
    return {"campaign_id": vendor.campaign_id, "vendor_id": vendor.id}


@router.post("/register-verifier", response_model=AccountOut, status_code=201)
def register_verifier(payload: VerifierRegistration, response: Response, db: Session = Depends(get_db)):
    if not settings.verifier_key or not hmac.compare_digest(payload.bootstrap_key, settings.verifier_key):
        raise HTTPException(403, "Invalid verifier enrollment key.")
    user = _new_user(db, payload, "verifier")
    return _start_session(db, response, user)


@router.post("/login", response_model=AccountOut)
def login(payload: Credentials, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email.casefold()).first()
    if user is None or not _password_matches(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")
    return _start_session(db, response, user)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.query(UserSession).filter_by(token_hash=_digest(token)).delete()
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"signed_out": True}


@router.get("/me", response_model=AccountOut)
def me(user: User = Depends(current_user)):
    return _account(user)


@router.get("/my-campaigns", response_model=list[CampaignOut])
def my_campaigns(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(Campaign)
    if user.role == "organizer":
        query = query.filter(Campaign.organizer_user_id == user.id)
    elif user.role == "vendor":
        query = query.join(Vendor).filter(Vendor.user_id == user.id).distinct()
    return [CampaignOut.model_validate(campaign) for campaign in query.order_by(Campaign.id).all()]


@router.get("/my-vendors")
def my_vendors(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != "vendor":
        return []
    return [{"id": vendor.id, "campaign_id": vendor.campaign_id}
            for vendor in db.query(Vendor).filter_by(user_id=user.id).all()]


@router.get("/reconciliation-issues")
def reconciliation_issues(db: Session = Depends(get_db), _=Depends(require_verifier)):
    issues = db.query(ReconciliationIssue).order_by(ReconciliationIssue.created_at.desc()).limit(100).all()
    return [{"id": issue.id, "event_id": issue.event_id, "campaign_id": issue.campaign_id,
             "reference": issue.reference, "detail": issue.detail, "created_at": issue.created_at.isoformat() + "Z"}
            for issue in issues]


@router.post("/campaigns/{campaign_id}/vendors/{vendor_id}/invite")
def create_vendor_invite(campaign_id: int, vendor_id: int, request: Request,
                         db: Session = Depends(get_db), _=Depends(require_organizer)):
    campaign = db.get(Campaign, campaign_id)
    vendor = db.get(Vendor, vendor_id)
    if campaign is None or campaign.organizer_user_id != request.state.actor.id:
        raise HTTPException(404, "Campaign not found in your workspace.")
    if vendor is None or vendor.campaign_id != campaign_id:
        raise HTTPException(404, "Vendor is not assigned to this campaign.")
    if vendor.user_id is not None:
        raise HTTPException(409, "Vendor already has an account.")
    token = secrets.token_urlsafe(32)
    db.add(VendorInvite(vendor_id=vendor_id, token_hash=_digest(token), expires_at=_now() + timedelta(days=7)))
    db.commit()
    return {"email": vendor.payout_email, "invite_token": token, "expires_in_days": 7}


@router.post("/campaigns/{campaign_id}/claim")
def claim_legacy_campaign(campaign_id: int, payload: LegacyClaim, request: Request,
                          db: Session = Depends(get_db), _=Depends(require_organizer)):
    if not settings.admin_setup_key or not hmac.compare_digest(payload.setup_key, settings.admin_setup_key):
        raise HTTPException(403, "Invalid setup key.")
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found.")
    if campaign.organizer_user_id is not None:
        raise HTTPException(409, "Campaign already has an organizer.")
    campaign.organizer_user_id = request.state.actor.id
    db.commit()
    return {"campaign_id": campaign_id, "organizer": request.state.actor.email}
