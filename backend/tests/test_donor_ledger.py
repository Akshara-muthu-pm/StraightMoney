"""Failed checkout attempts never become public contributions or future funds."""
from unittest.mock import AsyncMock

import main
from tests.test_donation_controls import client


def test_failed_attempt_then_success_credits_only_success(client, monkeypatch):
    ids = iter(['FAILED-ORDER', 'SUCCESS-ORDER'])
    async def create_order(**kwargs):
        order_id = next(ids)
        return {'id': order_id, 'links': [{'rel': 'approve', 'href': f'https://www.sandbox.paypal.com/checkoutnow?token={order_id}'}]}
    async def get_order(order_id):
        status = 'DENIED' if order_id == 'FAILED-ORDER' else 'COMPLETED'
        return {'id': order_id, 'status': 'COMPLETED', 'purchase_units': [{'payments': {'captures': [
            {'id': f'CAP-{order_id}', 'status': status, 'amount': {'value': '30.00', 'currency_code': 'USD'}}]}}]}
    monkeypatch.setattr(type(main.paypal), 'is_configured', property(lambda self: True))
    monkeypatch.setattr(main.paypal, 'create_order', create_order)
    monkeypatch.setattr(main.paypal, 'get_order', get_order)
    monkeypatch.setattr(main, 'pay_campaign', AsyncMock())

    payload = {'donor_name': 'Failed donor', 'amount': 30}
    assert client.post('/campaigns/1/donations', json=payload).status_code == 201
    assert client.get('/campaigns/1/ledger').json() == []  # created is private
    result = client.post('/donations/FAILED-ORDER/capture')
    assert result.status_code == 200
    assert result.json()['status'] == 'failed'
    assert client.get('/campaigns/1/ledger').json() == []
    assert client.get('/campaigns/1').json()['pool_balance'] == 0
    availability = client.get('/campaigns/1/availability').json()
    assert availability['raised'] == availability['reserved'] == 0
    assert availability['remaining'] == 100

    payload['donor_name'] = 'Successful donor'
    assert client.post('/campaigns/1/donations', json=payload).status_code == 201
    for _ in range(2):
        response = client.post('/donations/SUCCESS-ORDER/capture')
        assert response.status_code == 200
        assert response.json()['status'] == 'captured'  # provider lifecycle is retained internally
    rows = client.get('/campaigns/1/ledger').json()
    assert len(rows) == 1
    assert rows[0]['status'] == 'donated'
    assert rows[0]['actor_name'].startswith('Donor ')
    assert 'Successful donor' not in rows[0]['actor_name']
    assert rows[0]['public_reference'].startswith('SM-D-')
    assert rows[0]['amount'] == 30
    assert client.get('/campaigns/1').json()['pool_balance'] == 30
    assert client.get('/campaigns/1/availability').json()['remaining'] == 70
    report = client.get('/campaigns/1/report.csv')
    assert report.status_code == 200
    assert 'Failed donor' not in report.text
    assert 'donated' in report.text
