"""Reset selected local sandbox campaign donations, preserving setup and a backup.

Stop the API first. List IDs, then supply explicit IDs; never matches names loosely.
This does not refund or erase transactions at PayPal.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from db import SessionLocal
from config import settings
from models import Campaign, Donation, PaymentAdjustment, BudgetLine, Invoice, Payout, PayoutInstallment


def reset(db, ids, backup_path):
    campaigns = db.query(Campaign).filter(Campaign.id.in_(ids)).with_for_update().all()
    if {c.id for c in campaigns} != set(ids):
        raise ValueError('One or more campaign IDs do not exist. No reset performed.')
    # Never reset funding supporting paid or currently processing vendor invoices.
    invoice_ids = select(Invoice.id).where(Invoice.campaign_id.in_(ids))
    if (db.query(BudgetLine).filter(BudgetLine.campaign_id.in_(ids), BudgetLine.paid_amount > 0).first()
        or db.query(Payout).filter(Payout.invoice_id.in_(invoice_ids), Payout.status.in_(['pending', 'success'])).first()
        or db.query(PayoutInstallment).filter(PayoutInstallment.invoice_id.in_(invoice_ids), PayoutInstallment.status.in_(['pending', 'success'])).first()):
        raise ValueError('Selected campaigns have paid or pending vendor payouts. Reset refused to preserve accounting.')
    donations = db.query(Donation).filter(Donation.campaign_id.in_(ids)).all()
    if any(d.status == 'pending' or d.paypal_capture_status == 'CAPTURE_IN_PROGRESS' for d in donations):
        raise ValueError('A payment is processing. Reconcile it before resetting this campaign.')
    adjustments = db.query(PaymentAdjustment).filter(PaymentAdjustment.donation_id.in_([d.id for d in donations])).all()
    def row(obj):
        return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    backup = {'created_utc': datetime.now(timezone.utc).isoformat(),
              'campaigns': [row(c) for c in campaigns], 'donations': [row(d) for d in donations],
              'payment_adjustments': [row(a) for a in adjustments]}
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive create and successful durable backup before deleting any records.
    with backup_path.open('x', encoding='utf-8') as f:
        json.dump(backup, f, indent=2, default=str)
        f.flush()
        import os
        os.fsync(f.fileno())
    for a in adjustments:
        db.delete(a)
    db.flush()
    for d in donations:
        db.delete(d)
    for c in campaigns:
        c.pool_balance = 0
    db.commit()
    return len(donations)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--campaign-ids', type=int, nargs='+')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if settings.paypal_base_url.rstrip('/') != 'https://api-m.sandbox.paypal.com':
        parser.error('Sandbox only.')
    with SessionLocal() as db:
        if not args.campaign_ids or not args.apply:
            for c in db.query(Campaign).order_by(Campaign.id):
                print(f'ID {c.id}: {c.title} | pool {c.currency} {c.pool_balance:.2f} | goal {c.goal_amount:.2f}')
            print('Preview only. To reset ONLY Stationary and Sports, identify their IDs above, then run with --campaign-ids ID1 ID2 --apply.')
            return
        backup = Path(__file__).resolve().parents[2] / 'reset-backups' / f'donations-{datetime.now(timezone.utc):%Y%m%dT%H%M%S%fZ}.json'
        try:
            count = reset(db, args.campaign_ids, backup)
        except ValueError as exc:
            parser.error(str(exc))
        print(f'Reset {count} local donation records for campaigns {args.campaign_ids}. Backup: {backup}')
        print('PayPal sandbox transactions are unchanged. Sign out and back in to clear old session receipts.')


if __name__ == '__main__':
    main()
