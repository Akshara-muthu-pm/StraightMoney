"""Seed the section 14 demo campaign, vendors, and budget lines."""

from __future__ import annotations

from sqlalchemy.orm import Session

from models import BudgetLine, Campaign, Vendor


def seed_demo_data(db: Session) -> None:
    """Insert the demo campaigns once; leave donations to the PayPal flow."""
    if not db.query(Campaign).filter_by(title="School Library Corner").first():
        campaign = Campaign(
            title="School Library Corner",
            description="A school library corner with shelves, books, and paint.",
            goal_amount=1200.0,
            currency="USD",
            pool_balance=0.0,
            status="active",
            organizer_name="Demo Organizer",
        )
        db.add(campaign)
        db.flush()

        for name, email, item, amount in (
            ("Vendor A", "vendor-a@example.com", "Shelves", 400.0),
            ("Vendor B", "vendor-b@example.com", "Books", 600.0),
            ("Vendor C", "vendor-c@example.com", "Paint", 200.0),
        ):
            vendor = Vendor(
                campaign_id=campaign.id,
                name=name,
                payout_email=email,
                status="active",
            )
            db.add(vendor)
            db.flush()
            db.add(BudgetLine(
                campaign_id=campaign.id,
                name=item,
                vendor_id=vendor.id,
                budgeted_amount=amount,
                paid_amount=0.0,
            ))
        db.commit()

    if not db.query(Campaign).filter_by(title="AeroDrone Ag - Autonomous Precision Drone").first():
        startup = Campaign(
            title="AeroDrone Ag - Autonomous Precision Drone",
            description="Hardware venture building autonomous precision spraying drones for sustainable agriculture. Capital is held in PayPal Sandbox escrow. Funds disburse in tranches only after airframe dimensional test reports and motor bench test photos pass AI and human verification.",
            goal_amount=12500.0,
            currency="USD",
            pool_balance=0.0,
            status="active",
            organizer_name="AeroSky BioSystems Lab",
        )
        db.add(startup)
        db.flush()

        for name, email, item, amount in (
            ("AeroFab Machining Co.", "aerofab@example.com", "Carbon-Fiber Airframe & Folding Arm Machining", 3500.0),
            ("TorqueDrive Dynamics", "motors@example.com", "High-Torque Brushless Motors & 80A ESC Units", 4800.0),
            ("SpectraVision Labs", "spectravision@example.com", "Multispectral Crop Health Sensor & Telemetry Pack", 4200.0),
        ):
            vendor = Vendor(
                campaign_id=startup.id,
                name=name,
                payout_email=email,
                status="active",
            )
            db.add(vendor)
            db.flush()
            db.add(BudgetLine(
                campaign_id=startup.id,
                name=item,
                vendor_id=vendor.id,
                budgeted_amount=amount,
                paid_amount=0.0,
            ))
        db.commit()


if __name__ == "__main__":
    from db import SessionLocal, init_db

    init_db()
    with SessionLocal() as session:
        seed_demo_data(session)
        campaign = session.query(Campaign).filter_by(title="School Library Corner").one()
        print(f"Seed ready: campaign={campaign.title}, vendors={len(campaign.vendors)}, budget_lines={len(campaign.budget_lines)}")
