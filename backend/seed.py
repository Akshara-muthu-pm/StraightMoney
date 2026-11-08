"""Seed example campaigns, vendors, and budget lines."""

from __future__ import annotations

from sqlalchemy.orm import Session

from models import BudgetLine, Campaign, Vendor


PUBLIC_CAUSES = (
    (
        "Community Garden Beds",
        "Build accessible garden beds and provide soil, seedlings, and tools for a neighborhood growing space.",
        2400.0,
        "Neighborhood Garden Collective",
        (
            ("Garden Supply Co.", "garden-supply@example.com", "Raised beds and lumber", 1050.0),
            ("Green Earth Nursery", "green-earth@example.com", "Soil and seedlings", 850.0),
            ("Community Tool Shed", "tool-shed@example.com", "Shared garden tools", 500.0),
        ),
    ),
    (
        "Neighborhood Food Pantry",
        "Stock a community pantry with staple foods, storage shelves, and reusable distribution boxes.",
        3200.0,
        "Neighborhood Pantry Volunteers",
        (
            ("Local Food Cooperative", "food-coop@example.com", "Shelf-stable groceries", 2000.0),
            ("Pantry Fixtures", "pantry-fixtures@example.com", "Storage shelves", 750.0),
            ("Community Packaging", "packaging@example.com", "Reusable distribution boxes", 450.0),
        ),
    ),
    (
        "After-School Art Room",
        "Equip an after-school art room with reusable supplies, worktables, and display materials.",
        1800.0,
        "Community Arts Circle",
        (
            ("Creative Supplies", "creative-supplies@example.com", "Paint, brushes, and paper", 800.0),
            ("Workshop Furnishings", "workshop-furnishings@example.com", "Worktables and stools", 700.0),
            ("Art Display Studio", "art-display@example.com", "Display boards and frames", 300.0),
        ),
    ),
    (
        "Park Cleanup Kit",
        "Provide gloves, litter grabbers, sorting bins, and safety supplies for recurring park cleanups.",
        1500.0,
        "Friends of the Park",
        (
            ("Clean Streets Supply", "clean-streets@example.com", "Gloves and litter grabbers", 650.0),
            ("Recycling Works", "recycling-works@example.com", "Sorting bins", 550.0),
            ("Volunteer Safety Store", "volunteer-safety@example.com", "Safety vests and first-aid kits", 300.0),
        ),
    ),
)


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

    for title, description, goal, organizer, lines in PUBLIC_CAUSES:
        if db.query(Campaign.id).filter_by(title=title).first():
            continue
        cause = Campaign(
            title=title,
            description=description,
            goal_amount=goal,
            currency="USD",
            pool_balance=0.0,
            status="active",
            organizer_name=organizer,
        )
        db.add(cause)
        db.flush()
        for vendor_name, email, item, amount in lines:
            vendor = Vendor(campaign_id=cause.id, name=vendor_name, payout_email=email, status="active")
            db.add(vendor)
            db.flush()
            db.add(BudgetLine(
                campaign_id=cause.id,
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
