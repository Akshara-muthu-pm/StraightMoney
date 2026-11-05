"""
db.py — SQLAlchemy engine, session factory, base class, and FastAPI dependency.
"""

from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"connect_timeout": 5} if settings.database_url.startswith("postgresql") else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables and apply the additive migrations needed by older databases."""
    # Import models so SQLAlchemy picks up all mapped classes before create_all
    import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        migration_dir = Path(__file__).resolve().parent / "migrations"
        with engine.begin() as connection:
            for name in ("001_donation_capture_status.sql", "002_donation_source.sql", "003_invoice_document_hash.sql", "004_accounts.sql", "005_closeout_refunds.sql"):
                connection.execute(text((migration_dir / name).read_text(encoding="utf-8")))

