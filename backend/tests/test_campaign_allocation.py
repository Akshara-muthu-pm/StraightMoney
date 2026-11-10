"""Campaign goal must be allocated exactly before a campaign is created."""
import pytest
from sqlalchemy.orm import Session
from models import Campaign
from tests.test_accounts_webhooks import client, _register


def payload(goal=600, amount=600):
    return {'title':'Dining','goal_amount':goal,'organizer_name':'Organizer',
            'budget_lines':[{'name':'Utensils','budgeted_amount':amount,'vendor_name':'Supplier','vendor_payout_email':'supplier@example.com'}]}


@pytest.mark.parametrize('amount',[500,601])
def test_under_and_over_allocated_campaigns_are_not_saved(client,amount):
    browser,engine=client
    _register(browser,'organizer','owner@example.com')
    response=browser.post('/campaigns',json=payload(amount=amount))
    assert response.status_code==422,response.text
    assert 'Allocate the entire goal exactly' in response.text
    with Session(engine) as db:
        assert db.query(Campaign).count()==0


def test_missing_lines_or_unassigned_vendor_is_rejected(client):
    browser,_=client
    _register(browser,'organizer','owner@example.com')
    body=payload();body['budget_lines']=[]
    assert browser.post('/campaigns',json=body).status_code==422
    body=payload();body['budget_lines'][0].pop('vendor_payout_email')
    assert browser.post('/campaigns',json=body).status_code==422


def test_multiple_vendor_allocations_and_exact_cents(client):
    browser,_=client
    _register(browser,'organizer','owner@example.com')
    body=payload(goal=0.30,amount=0.10)
    body['budget_lines'].append({'name':'Dining plates','budgeted_amount':0.20,'vendor_name':'Other supplier','vendor_payout_email':'other@example.com'})
    response=browser.post('/campaigns',json=body)
    assert response.status_code==201,response.text
    campaign=response.json()
    assert len(campaign['vendors'])==2
    assert all(line['vendor_id'] for line in campaign['budget_lines'])
    assert campaign['goal_amount']==0.30


def test_unused_vendor_cannot_be_added_without_a_budget_allocation(client):
    browser,engine=client
    _register(browser,'organizer','owner@example.com')
    body=payload()
    body['vendors']=[{'name':'Unassigned supplier','payout_email':'unused@example.com'}]
    response=browser.post('/campaigns',json=body)
    assert response.status_code==422,response.text
    assert 'Every campaign vendor' in response.text
    with Session(engine) as db:
        assert db.query(Campaign).count()==0


def test_organizer_can_create_more_than_five_campaigns_by_default(client):
    browser, _ = client
    _register(browser, 'organizer', 'owner@example.com')
    for _ in range(6):
        response = browser.post('/campaigns', json=payload())
        assert response.status_code == 201, response.text
    assert browser.get('/auth/campaign-creation-limit').json() == {
        'limit': None, 'count': 6, 'remaining': None,
    }
