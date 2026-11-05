ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS organizer_user_id INTEGER REFERENCES users(id);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS ix_campaigns_organizer_user_id ON campaigns (organizer_user_id);
CREATE INDEX IF NOT EXISTS ix_vendors_user_id ON vendors (user_id);
