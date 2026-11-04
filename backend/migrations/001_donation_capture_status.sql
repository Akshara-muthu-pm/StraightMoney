-- Run once against an existing PostgreSQL database before starting the updated API.
ALTER TABLE donations ADD COLUMN IF NOT EXISTS paypal_capture_status VARCHAR;
