ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS beneficiary TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS expected_deliverables TEXT;
