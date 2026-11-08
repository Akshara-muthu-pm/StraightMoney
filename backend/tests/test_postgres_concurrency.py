"""Optional real-PostgreSQL checks; use an isolated disposable test database."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
from threading import Barrier, Lock
import uuid

from fastapi import HTTPException
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from db import Base
from models import Campaign, Vendor, BudgetLine, Invoice, Verification, PayoutInstallment, StoredFile
from models import Donation
from installments import pay_available, _apply_status
from schemas import VerificationCreate
import main


@pytest.fixture
def postgres():
    url = os.environ.get("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("TEST_POSTGRES_URL is required for real PostgreSQL locking checks")
    admin = create_engine(url)
    schema = "test_" + uuid.uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={"options":f"-csearch_path={schema}"})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        campaign=Campaign(title="Test",goal_amount=1000,currency="USD",pool_balance=200,status="active",organizer_name="O")
        db.add(campaign); db.flush()
        vendor=Vendor(campaign_id=campaign.id,name="V",payout_email="v@example.com",status="active")
        db.add(vendor); db.flush()
        line=BudgetLine(campaign_id=campaign.id,name="Work",vendor_id=vendor.id,budgeted_amount=1000,paid_amount=0)
        db.add(line); db.flush()
        invoice=Invoice(campaign_id=campaign.id,budget_line_id=line.id,vendor_id=vendor.id,
            invoice_number="ONE",amount=1000,currency="USD",payout_email=vendor.payout_email,status="AWAITING_FUNDS")
        db.add(invoice); db.flush()
        db.add(Verification(invoice_id=invoice.id,verifier_name="R",decision="approve"))
        db.commit()
        invoice_id=invoice.id
    yield engine, invoice_id
    engine.dispose()
    with admin.begin() as connection:
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    admin.dispose()


class ConfirmedPayPal:
    def __init__(self):
        self.keys=set()
        self.lock=Lock()
    async def create_payout(self,**kwargs):
        with self.lock:
            self.keys.add(kwargs["sender_batch_id"])
        await asyncio.sleep(0.05)
        return {"batch_header":{"payout_batch_id":"ONE-BATCH"},"items":[{"transaction_status":"SUCCESS"}]}
    async def get_payout_status(self,batch):
        return {"batch_header":{"payout_batch_id":batch},"items":[{"transaction_status":"SUCCESS"}]}


def test_concurrent_allocation_reserves_and_debits_only_once(postgres):
    engine, invoice_id=postgres
    barrier=Barrier(2)
    paypal=ConfirmedPayPal()
    def worker():
        with Session(engine) as db:
            invoice=db.get(Invoice,invoice_id)
            barrier.wait(timeout=10)
            asyncio.run(pay_available(db,invoice,paypal))
    with ThreadPoolExecutor(max_workers=2) as workers:
        list(workers.map(lambda _: worker(),range(2)))
    with Session(engine) as db:
        invoice=db.get(Invoice,invoice_id)
        assert invoice.campaign.pool_balance == 0
        assert invoice.budget_line.paid_amount == 200
        assert invoice.paid_amount == 200
        assert len(invoice.installments) == 1
    assert len(paypal.keys) == 1


def test_concurrent_donors_cannot_reserve_more_than_campaign_goal(postgres):
    engine, _ = postgres
    with Session(engine) as db:
        campaign = db.query(Campaign).one()
        campaign.goal_amount = 300  # $200 raised, $100 available.
        db.commit()
        campaign_id = campaign.id
    barrier = Barrier(2)

    def worker(index):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            try:
                main._reserve_donation(db, campaign_id,
                    main.DonationCreate(donor_name=f"Donor {index}", amount=80, simulate=True))
                return 201
            except HTTPException as exc:
                return exc.status_code

    with ThreadPoolExecutor(max_workers=2) as workers:
        assert sorted(workers.map(worker, range(2))) == [201, 409]
    with Session(engine) as db:
        assert db.query(Donation).filter(Donation.status == "created").count() == 1
        assert main._campaign_funding(db, db.get(Campaign, campaign_id))["remaining"] == 20


def test_concurrent_settlement_is_idempotent(postgres):
    engine, invoice_id=postgres
    with Session(engine) as db:
        part=PayoutInstallment(invoice_id=invoice_id,sender_batch_id="reserved",paypal_batch_id="BATCH",amount=200,currency="USD",status="pending")
        db.add(part); db.commit(); part_id=part.id
    barrier=Barrier(2)
    def worker():
        with Session(engine) as db:
            part=db.get(PayoutInstallment,part_id)
            _=part.invoice.campaign.pool_balance
            barrier.wait(timeout=10)
            _apply_status(db,part,{"batch_header":{"payout_batch_id":"BATCH"},"items":[{"transaction_status":"SUCCESS"}]})
    with ThreadPoolExecutor(max_workers=2) as workers:
        list(workers.map(lambda _: worker(),range(2)))
    with Session(engine) as db:
        invoice=db.get(Invoice,invoice_id)
        assert invoice.campaign.pool_balance == 0
        assert invoice.budget_line.paid_amount == 200
        assert invoice.paid_amount == 200


def test_concurrent_approvals_cannot_overcommit_budget(postgres):
    engine, invoice_id=postgres
    with Session(engine) as db:
        invoice=db.get(Invoice,invoice_id)
        db.query(Verification).delete()
        invoice.status="AWAITING_VERIFIER"; invoice.amount=400
        invoice.campaign.pool_balance=0; invoice.budget_line.budgeted_amount=400
        other=Invoice(campaign_id=invoice.campaign_id,budget_line_id=invoice.budget_line_id,vendor_id=invoice.vendor_id,
            invoice_number="TWO",amount=400,currency="USD",payout_email=invoice.payout_email,status="AWAITING_VERIFIER")
        db.add(other); db.flush()
        for row in (invoice,other):
            db.add(StoredFile(invoice_id=row.id,kind="proof",filename="proof.png",mime_type="image/png",data=b"fixture"))
        db.commit(); ids=[invoice.id,other.id]
    barrier=Barrier(2)
    def worker(id):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            try:
                asyncio.run(main.approve_invoice(id,VerificationCreate(verifier_name="R"),db))
                return 200
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as workers:
        results=list(workers.map(worker,ids))
    assert sorted(results) == [200,409]
    with Session(engine) as db:
        assert db.query(Verification).count() == 1


def test_additive_migrations_upgrade_old_schema_and_repeat_safely(postgres,monkeypatch):
    engine,_=postgres
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE invoices DROP COLUMN document_hash"))
        connection.execute(text("ALTER TABLE donations DROP COLUMN source"))
        connection.execute(text("ALTER TABLE donations DROP COLUMN paypal_capture_status"))
        connection.execute(text("ALTER TABLE donations DROP COLUMN capacity_reserved"))
    import db as database
    monkeypatch.setattr(database,"engine",engine)
    database.init_db()
    database.init_db()
    from sqlalchemy import inspect
    assert "document_hash" in {column["name"] for column in inspect(engine).get_columns("invoices")}
    assert {"source","paypal_capture_status","capacity_reserved"} <= {column["name"] for column in inspect(engine).get_columns("donations")}


def test_api_startup_and_real_sample_upload(postgres,monkeypatch):
    from datetime import timedelta
    from pathlib import Path
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import sessionmaker
    from config import settings
    from db import get_db
    from auth import COOKIE_NAME, _digest, _now
    from models import User, UserSession
    import db as database
    engine,_=postgres
    monkeypatch.setattr(database,"engine",engine)
    monkeypatch.setattr(main,"SessionLocal",sessionmaker(bind=engine))
    monkeypatch.setattr(settings,"llm_api_key","")
    monkeypatch.delenv("GEMINI_API_KEY",raising=False)
    def session():
        with Session(engine) as db:
            yield db
    main.app.dependency_overrides[get_db]=session
    try:
        with TestClient(main.app) as browser:
            assert browser.get("/health").status_code == 200
            campaigns=browser.get("/campaigns").json()
            seeded=next(row for row in campaigns if row["title"]=="School Library Corner")
            campaign=browser.get(f'/campaigns/{seeded["id"]}').json()
            line=next(row for row in campaign["budget_lines"] if row["name"]=="Shelves")
            with Session(engine) as db:
                user=User(email="vendor-fixture@example.com",name="Vendor",password_hash="fixture",role="vendor")
                db.add(user); db.flush()
                db.get(Vendor,line["vendor_id"]).user_id=user.id
                db.add(UserSession(user_id=user.id,token_hash=_digest("vendor-fixture"),
                                   expires_at=_now()+timedelta(days=1)))
                db.commit()
            browser.cookies.set(COOKIE_NAME,"vendor-fixture")
            samples=Path(__file__).resolve().parents[2]/"sample_invoices"
            response=browser.post("/invoices",data={"campaign_id":campaign["id"],"budget_line_id":line["id"],"invoice_number":"SHELVES-001"},
                files={"invoice_file":("invoice.pdf",(samples/"vendor_a_shelves_valid.pdf").read_bytes(),"application/pdf"),
                       "proof_photo":("proof.jpg",(samples/"proof_shelves.jpg").read_bytes(),"image/jpeg")})
            assert response.status_code == 201,response.text
            assert response.json()["status"] == "AWAITING_VERIFIER"
            assert response.json()["invoice_number"] == "SHELVES-001"
            assert browser.get('/'+response.json()["evidence_path"]).status_code == 200
    finally:
        main.app.dependency_overrides.clear()
