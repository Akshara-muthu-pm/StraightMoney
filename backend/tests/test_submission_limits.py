"""Account creation quota and early invoice guardrails."""
from unittest.mock import AsyncMock

from sqlalchemy.orm import Session
import main
from config import settings
from models import BudgetLine, Campaign
from tests.test_accounts_webhooks import client, _register


def test_creation_quota_is_per_account_and_configurable(client, monkeypatch):
    browser, _ = client
    monkeypatch.setattr(settings, 'max_campaigns_per_organizer', 1)
    _register(browser, 'organizer', 'first@example.com')
    payload = {'title': 'Test', 'goal_amount': 600, 'organizer_name': 'Owner', 'budget_lines': [{'name':'Supplies', 'budgeted_amount':600, 'vendor_name':'Supplier', 'vendor_payout_email':'supplier@example.com'}]}
    assert browser.post('/campaigns', json=payload).status_code == 201
    assert browser.get('/auth/campaign-creation-limit').json() == {'limit': 1, 'count': 1, 'remaining': 0}
    response = browser.post('/campaigns', json=payload)
    assert response.status_code == 409
    assert 'limit reached' in response.json()['detail']
    browser.post('/auth/logout')
    _register(browser, 'organizer', 'second@example.com')
    assert browser.post('/campaigns', json=payload).status_code == 201


def test_fully_paid_or_closed_assignment_stops_before_extraction(client, monkeypatch):
    browser, engine = client
    _register(browser, 'organizer', 'owner@example.com')
    payload = {'title': 'Bats', 'goal_amount': 600, 'organizer_name': 'Owner',
               'budget_lines': [{'name': 'bat', 'budgeted_amount': 600,
                                 'vendor_name': 'snu', 'vendor_payout_email': 'snu@example.com'}]}
    response = browser.post('/campaigns', json=payload)
    assert response.status_code == 201, response.text
    campaign = response.json()
    line = campaign['budget_lines'][0]
    invite = browser.post(f"/auth/campaigns/{campaign['id']}/vendors/{line['vendor_id']}/invite").json()
    browser.post('/auth/logout')
    assert _register(browser, 'vendor', 'snu@example.com', invite_token=invite['invite_token']).status_code == 201
    extract = AsyncMock()
    monkeypatch.setattr(main.extraction_module, 'extract_invoice', extract)
    data = {'campaign_id': campaign['id'], 'budget_line_id': line['id'], 'invoice_number': 'BAT-TEST'}
    with Session(engine) as db:
        db.get(BudgetLine, line['id']).paid_amount = 600
        db.commit()
    response = browser.post('/invoices', data=data)
    assert response.status_code == 409
    assert 'fully paid' in response.json()['detail']
    with Session(engine) as db:
        db.get(BudgetLine, line['id']).paid_amount = 0
        db.get(Campaign, campaign['id']).status = 'closed'
        db.commit()
    assert browser.post('/invoices', data=data).status_code == 409
    with Session(engine) as db:
        db.get(Campaign, campaign['id']).status = 'active'
        db.commit()
    response = browser.post('/invoices', data=data)
    assert response.status_code == 400
    assert 'proof photo' in response.json()['detail']
    extract.assert_not_awaited()
