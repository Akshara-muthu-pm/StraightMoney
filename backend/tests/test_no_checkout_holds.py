from pathlib import Path
from sqlalchemy.orm import Session
from unittest.mock import AsyncMock
import pytest
import main
from config import settings
from models import Campaign, Donation
from tests.test_donor_ledger import client
from tests.test_accounts_webhooks import client as account_client


def test_unpaid_checkouts_do_not_block_later_donations(client, monkeypatch):
    monkeypatch.setattr(settings, 'allow_simulated_donations', True)
    ids = []
    for _ in range(3):
        response = client.post('/campaigns/1/donations', json={'donor_name':'Test','amount':85,'simulate':True})
        assert response.status_code == 201
        ids.append(response.json()['paypal_order_id'])
    available = client.get('/campaigns/1/availability').json()
    assert available['remaining'] == 100
    assert available['reserved'] == 0
    assert client.post(f'/donations/{ids[0]}/capture').json()['status'] == 'captured'
    # A second checkout remains open but cannot capture beyond the goal.
    response = client.post(f'/donations/{ids[1]}/capture')
    assert response.status_code == 409
    assert client.get('/campaigns/1').json()['pool_balance'] == 85
    assert client.get('/campaigns/1/availability').json()['remaining'] == 15
    assert client.post('/campaigns/1/donations', json={'donor_name':'Next','amount':15,'simulate':True}).status_code == 201


def test_legacy_abandoned_holds_are_ignored(client):
    override = main.app.dependency_overrides[main.get_db]
    session = override(); db = next(session)
    db.add(Donation(campaign_id=1, donor_name='Old', amount=100, currency='USD',
                    paypal_order_id='OLD', status='created', source='paypal', capacity_reserved=True))
    db.commit(); session.close()
    result = client.get('/campaigns/1/availability').json()
    assert result['remaining'] == 100
    assert result['reserved'] == 0


def test_reset_is_targeted_and_backed_up(account_client, tmp_path):
    from scripts.reset_campaign_donations import reset
    _, engine = account_client
    with Session(engine) as db:
        db.add_all([Campaign(id=1,title='Stationary',goal_amount=1000,pool_balance=85,organizer_name='A'),
                    Campaign(id=2,title='Sports',goal_amount=600,pool_balance=20,organizer_name='A'),
                    Campaign(id=3,title='Other',goal_amount=50,pool_balance=10,organizer_name='A')])
        db.flush()
        for i, amount in [(1,85),(2,20),(3,10)]:
            db.add(Donation(campaign_id=i,donor_name='D',amount=amount,currency='USD',paypal_order_id=f'ORDER-{i}',status='captured',source='paypal'))
        db.commit()
        backup=tmp_path/'backup.json'
        assert reset(db,[1,2],backup)==2
        assert backup.exists() and 'Stationary' in backup.read_text()
        assert db.get(Campaign,1).pool_balance == db.get(Campaign,2).pool_balance == 0
        assert db.get(Campaign,3).pool_balance == 10
        assert db.query(Donation).count() == 1
