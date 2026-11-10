"""Public privacy, financial truth and non-authorizing review guidance."""
import json
from sqlalchemy.orm import Session
from models import Donation, Invoice, PayoutInstallment, Verification
from tests.test_regressions import client, upload, as_role, reset_rate_limits
from public_progress import review_guidance


def test_public_ledger_and_csv_anonymize_donors_and_never_expose_paypal_ids(client):
    browser, engine, _ = client
    with Session(engine) as db:
        db.add(Donation(campaign_id=1, donor_name='Private Person private@example.com', amount=25,currency='USD',
            paypal_order_id='PRIVATE-ORDER-123',paypal_capture_id='PRIVATE-CAPTURE-456',source='paypal',status='captured'))
        db.commit()
    rows=browser.get('/campaigns/1/ledger').json()
    row=next(r for r in rows if r['type']=='donation')
    assert row['actor_name'].startswith('Donor ')
    assert row['public_reference'].startswith('SM-D-')
    assert browser.get('/campaigns/1/ledger').json() == rows
    report=browser.get('/campaigns/1/report.csv').text
    for secret in ['Private Person','private@example.com','PRIVATE-ORDER-123','PRIVATE-CAPTURE-456']:
        assert secret not in json.dumps(rows) and secret not in report
    assert 'financial' in report and row['public_reference'] in report
    from main import _csv_cell
    assert _csv_cell('=HYPERLINK("example.com")').startswith("'=")


def test_funded_evidence_and_approval_are_not_confirmed_payment(client):
    browser,engine,_=client
    before=browser.get('/campaigns/1/progress').json()
    assert before['funded'] and before['claims']==[]
    inv=upload(browser).json()
    assert inv['review_guidance']['depth']=='standard'
    progress=browser.get('/campaigns/1/progress').json()
    assert progress['claims'][0]['evidence_submitted']
    assert not progress['claims'][0]['approved'] and not progress['claims'][0]['vendor_paid']
    with Session(engine) as db:
        db.add(Verification(invoice_id=inv['id'],verifier_name='Reviewer',decision='approve',note='PRIVATE CONFIRMATION DETAIL'))
        db.get(Invoice,inv['id']).status='PAYOUT_PENDING'
        db.add(PayoutInstallment(invoice_id=inv['id'],sender_batch_id='PRIVATE-KEY',paypal_batch_id='PRIVATE-BATCH',amount=400,currency='USD',status='pending'))
        db.commit()
    progress=browser.get('/campaigns/1/progress').json()
    claim=progress['claims'][0]
    assert claim['approved'] and not claim['vendor_paid'] and claim['confirmed_paid']==0
    assert 'PRIVATE' not in json.dumps(progress) and 'vendor@example.com' not in json.dumps(progress)
    with Session(engine) as db:
        part=db.query(PayoutInstallment).one();part.status='success';db.get(Invoice,inv['id']).status='PAID';db.commit()
    claim=browser.get('/campaigns/1/progress').json()['claims'][0]
    assert claim['vendor_paid'] and claim['confirmed_paid']==400


def test_simulated_payout_is_not_a_public_financial_transfer(client):
    browser,engine,_=client
    inv=upload(browser).json()
    with Session(engine) as db:
        db.get(Invoice,inv['id']).status='FAILED'
        db.get(Invoice,inv['id']).ai_summary='Payout was simulated; no vendor received funds.'
        db.add(PayoutInstallment(invoice_id=inv['id'],sender_batch_id='test',paypal_batch_id='SANDBOX-FAKE',amount=400,currency='USD',status='failed'))
        db.commit()
    assert not any(row['type']=='payout' for row in browser.get('/campaigns/1/ledger').json())
    claim=browser.get('/campaigns/1/progress').json()['claims'][0]
    assert claim['payment_mode']=='simulated' and claim['payment_status']=='simulated'
    assert not claim['vendor_paid'] and claim['confirmed_paid']==0


def test_review_depth_changes_without_approving_any_claim(client):
    browser,engine,_=client
    inv=upload(browser).json()
    assert inv['review_guidance']['depth']=='standard'
    with Session(engine) as db:
        invoice=db.get(Invoice,inv['id']);invoice.ai_summary='Advisory flags: Photo is unclear.';db.commit()
        assert review_guidance(invoice)['depth']=='detailed'
        assert invoice.status=='AWAITING_VERIFIER'
    as_role(browser,'verifier')
    assert browser.post(f"/invoices/{inv['id']}/approve",json={'verifier_name':'Reviewer'}).status_code==422


def test_old_demo_escrow_copy_is_corrected_without_resetting_money(client):
    from seed import seed_demo_data, LEGACY_STARTUP_DESCRIPTION, STARTUP_DESCRIPTION
    from models import Campaign
    _,engine,_=client
    with Session(engine) as db:
        campaign=Campaign(title='AeroDrone Ag - Autonomous Precision Drone', description=LEGACY_STARTUP_DESCRIPTION,
                          goal_amount=12500,pool_balance=17,currency='USD',organizer_name='Demo',status='active')
        db.add(campaign);db.commit();cid=campaign.id
        seed_demo_data(db)
        db.refresh(campaign)
        assert campaign.description==STARTUP_DESCRIPTION
        assert campaign.pool_balance==17
        campaign.description='Custom user description';db.commit()
        seed_demo_data(db);db.refresh(campaign)
        assert campaign.description=='Custom user description' and campaign.pool_balance==17


def test_csv_explicitly_labels_simulated_donations(client):
    browser,engine,_=client
    with Session(engine) as db:
        db.add(Donation(campaign_id=1,donor_name='Test donor',amount=5,currency='USD',paypal_order_id='TEST-ONLY',source='simulated',status='captured'))
        db.commit()
    import csv,io
    rows=list(csv.DictReader(io.StringIO(browser.get('/campaigns/1/report.csv').content.decode('utf-8-sig'))))
    row=next(r for r in rows if r['entry_type']=='donation')
    assert row['payment_source']=='simulated' and row['record_group']=='financial'
