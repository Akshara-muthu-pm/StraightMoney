"""
config.py — Application configuration loaded from .env via pydantic-settings.
"""

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


REPO_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(REPO_ENV)


class Settings(BaseSettings):
    """All environment variables required by StraightMoney backend."""

    # PayPal credentials
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    paypal_simulate_payouts: bool = False
    allow_simulated_donations: bool = False
    max_donation_amount: float = Field(default=5000, gt=0, allow_inf_nan=False)
    verifier_key: str = ""
    admin_setup_key: str = ""
    paypal_webhook_id: str = ""

    # LLM (Gemini)
    llm_api_key: str = ""
    llm_model: str = "gemini-1.5-flash"
    llm_fallback_model: str = "gemini-3.5-flash-lite"

    # App defaults
    supported_currency: str = "USD"
    database_url: str
    upload_dir: str = "./uploads"
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, gt=0, le=25 * 1024 * 1024)
    max_pdf_pages: int = Field(default=20, gt=0, le=100)
    write_rate_limit: int = Field(default=30, gt=0)
    frontend_url: str = "http://localhost:3000"

    model_config = SettingsConfigDict(extra="ignore")


settings = Settings()
