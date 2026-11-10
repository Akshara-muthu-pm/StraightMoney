"""Independent review transitions, same-claim corrections and controlled amendments."""
import json
from sqlalchemy.orm import Session
from models import Invoice, InvoiceRevision, StoredFile, Campaign, CampaignAmendment, Vendor
from tests.test_regressions import client, upload, as_role, png, reset_rate_limits


def test_evidence_request_resubmission_keeps_claim_and_old_files(client):
    browser, engine, _ = client
    initial = upload(browser).json()
    as_role(browser, 'verifier')
    response = browser.post(f"/invoices/{initial['id']}/request-evidence", json={'note':'Upload a clearer recipient delivery photo.'})
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'MORE_EVIDENCE_REQUIRED'
    assert browser.post(f"/invoices/{initial['id']}/approve", json={'verifier_name':'V'}).status_code == 409
    # A verifier cannot submit vendor corrections.
    data = {'campaign_id':1,'budget_line_id':1,'invoice_number':'DOCUMENT-1',
            'original_invoice_id': initial['id'], 'correction_note':'Clearer delivery photograph attached.'}
    files = {'invoice_file': ('invoice.png',png(),'image/png'), 'proof_photo':('proof.png',png()+b'corrected','image/png')}
    assert browser.post('/invoices',data=data,files=files).status_code == 403
    as_role(browser,'vendor')
    result = browser.post('/invoices',data=data,files=files)
    assert result.status_code == 201, result.text
    corrected = result.json()
    assert corrected['id'] == initial['id']
    assert corrected['status'] == 'AWAITING_VERIFIER'
    assert len(corrected['revisions']) == 1
    assert corrected['revisions'][0]['snapshot']['evidence_path'] == initial['evidence_path']
    assert corrected['screening_facts']['amount'] == 400
    assert corrected['checks'] and corrected['campaign_requirements']['title']
    assert browser.get('/'+initial['evidence_path']).status_code == 200
    with Session(engine) as db:
        assert db.query(Invoice).count() == 1
        assert db.query(StoredFile).count() == 4
    # A second correction is forbidden until another evidence request is issued.
    assert browser.post('/invoices',data=data,files=files).status_code == 409


def test_escalation_blocks_payment_until_recorded_investigation(client):
    browser, _, _ = client
    inv = upload(browser).json()
    as_role(browser,'vendor')
    assert browser.post(f"/invoices/{inv['id']}/escalate",json={'note':'Suspicious delivery claim.'}).status_code == 403
    as_role(browser,'verifier')
    assert browser.post(f"/invoices/{inv['id']}/escalate",json={'note':'x'}).status_code == 422
    response=browser.post(f"/invoices/{inv['id']}/escalate",json={'note':'Recipient disputes the quantity delivered.'})
    assert response.status_code == 200
    assert response.json()['status'] == 'ESCALATED'
    approval={'verifier_name':'V','recipient_confirmed':True,'confirmation_reference':'School representative confirmed receipt by phone.'}
    assert browser.post(f"/invoices/{inv['id']}/approve",json=approval).status_code == 409
    assert browser.post(f"/invoices/{inv['id']}/retry",json={'verifier_name':'V'}).status_code == 409
    reopened=browser.post(f"/invoices/{inv['id']}/reopen",json={'note':'Investigated quantity and obtained recipient confirmation.'})
    assert reopened.status_code == 200
    assert reopened.json()['status'] == 'AWAITING_VERIFIER'
    assert [v['decision'] for v in reopened.json()['verifications']] == ['escalate','reopen']
    assert browser.post(f"/invoices/{inv['id']}/approve",json={'verifier_name':'V'}).status_code == 422
    assert browser.post(f"/invoices/{inv['id']}/approve",json=approval).status_code == 200


def test_rejection_requires_reason_and_is_not_silently_reopened(client):
    browser, _, _ = client
    inv=upload(browser).json()
    as_role(browser,'verifier')
    assert browser.post(f"/invoices/{inv['id']}/reject",json={'verifier_name':'V'}).status_code == 422
    rejected=browser.post(f"/invoices/{inv['id']}/reject",json={'verifier_name':'V','note':'Recipient confirms goods were not delivered.'})
    assert rejected.status_code == 200
    assert rejected.json()['status'] == 'VERIFIER_REJECTED'
    assert browser.post(f"/invoices/{inv['id']}/reopen",json={'note':'Try again'}).status_code == 409


def test_amendment_is_recorded_and_independently_reviewed(client):
    browser, engine, _ = client
    as_role(browser,'organizer')
    original=browser.get('/campaigns/1').json()
    proposed=browser.post('/campaigns/1/amendments',json={'note':'Recipient clarified the book order.',
                      'beneficiary':'School library', 'expected_deliverables':'40 books delivered to the library.'})
    assert proposed.status_code == 201,proposed.text
    aid=proposed.json()['id']
    assert browser.get('/campaigns/1').json()['goal_amount']==original['goal_amount']
    assert browser.post('/campaigns/1/amendments',json={'note':'Another change','goal_amount':1300}).status_code == 409
    assert browser.post(f'/amendments/{aid}/approve',json={'note':'Self approval is forbidden'}).status_code==403
    as_role(browser,'verifier')
    approved=browser.post(f'/amendments/{aid}/approve',json={'note':'Confirmed changed requirements with beneficiary.'})
    assert approved.status_code==200,approved.text
    assert approved.json()['previous']['goal_amount']==original['goal_amount']
    final=browser.get('/campaigns/1').json()
    assert final['goal_amount']==original['goal_amount'] and final['beneficiary']=='School library'
    assert browser.get('/campaigns/1/amendments').json()[0]['status']=='approved'
    assert browser.post(f'/amendments/{aid}/reject',json={'note':'Cannot change final decision'}).status_code==409


def test_amendment_cannot_reduce_target_below_funding_or_reassign_submitted_work(client):
    browser, engine, _=client
    upload(browser)
    # Older versions accepted mismatched targets before verifier review.
    with Session(engine) as db:
        amendment = CampaignAmendment(campaign_id=1, reason='Lower target requested',
                                     proposed_json=json.dumps({'goal_amount': 1}))
        db.add(amendment)
        db.commit()
        proposal = {'id': amendment.id}
    as_role(browser,'verifier')
    assert browser.post(f"/amendments/{proposal['id']}/approve",json={'note':'Review target reduction'}).status_code==409
    assert browser.post(f"/amendments/{proposal['id']}/reject",json={'note':'Cannot reduce below collected donations'}).status_code==200
    as_role(browser,'organizer')
    proposal=browser.post('/campaigns/1/amendments',json={'note':'Reassign submitted work','vendor_assignments':{'1':1}}).json()
    as_role(browser,'verifier')
    assert browser.post(f"/amendments/{proposal['id']}/approve",json={'note':'Review reassignment'}).status_code==409


def test_amendment_cannot_approve_unallocated_target(client):
    browser, engine, _ = client
    as_role(browser, 'organizer')
    response = browser.post('/campaigns/1/amendments', json={
        'note': 'Increase the target without adding a vendor allocation.', 'goal_amount': 1200,
    })
    assert response.status_code == 409
    assert 'total vendor budget' in response.json()['detail']

    with Session(engine) as db:
        amendment = CampaignAmendment(campaign_id=1, reason='Legacy target increase',
                                     proposed_json=json.dumps({'goal_amount': 1200}))
        db.add(amendment)
        db.commit()
        amendment_id = amendment.id
    as_role(browser, 'verifier')
    result = browser.post(f"/amendments/{amendment_id}/approve", json={'note': 'Review the proposed target.'})
    assert result.status_code == 409
    assert 'total vendor budget' in result.json()['detail']
    assert browser.get('/campaigns/1').json()['goal_amount'] == 400
