ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS ix_invoices_document_hash ON invoices (document_hash);
