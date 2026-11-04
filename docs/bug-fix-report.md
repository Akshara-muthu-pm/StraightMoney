# Repository bug fixes

The existing pages, visual styling, role workspaces, and donation → invoice → verifier → vendor payout workflow are retained. Changes to interface copy correct payment and verification claims; no account system or escrow product was introduced.

## Payment integrity

- Approvals recheck policy, remaining budget and other approved commitments under a campaign lock. Concurrent approvals cannot overcommit the same line.
- Allocation and settlement lock and refresh database records in a consistent order. Concurrent settlement cannot debit the pool or credit a line twice; stale pending responses cannot regress a confirmed payment.
- Payout reservations and keys survive network errors, server errors and failed status queries. Duplicate-batch responses can reconcile the original batch instead of creating another payment.
- New payout keys are persisted UUID-based keys, avoiding collisions after database resets; retries reuse the saved key.
- Simulated donations remain labeled and visible but cannot fund a PayPal payout or automatically trigger the payout queue.
- Donation capture reconciles existing orders, recovers completed captures after lost responses, uses a stable PayPal request ID, and verifies capture amount, currency and order identity before crediting funds. Unknown results remain pending for later reconciliation.
- Tokens refresh before expiration and retry once after a 401. Missing credentials cannot produce a fake successful capture or payout status.
- Sandbox safety checks require the exact PayPal Sandbox endpoint. Synchronous payout helpers preserve provider failures rather than reporting simulated success.
- Approval, rejection, donation accounting, payout accounting and their financial audit records are committed together.

## Invoice and upload safety

- Duplicate checks use the extracted invoice number, normalized comparisons and a document hash for new uploads. Changing a form number cannot disguise the same document.
- Uploads are checked by actual content and stored with canonical filenames and types. Proof must be a valid raster image; HTML and SVG cannot be uploaded as proof.
- Limits cover individual file bytes, total request bytes (including chunked bodies), PDF pages and image pixels. PDF parsing and file validation run outside the event loop.
- New invoice and proof bytes persist in PostgreSQL. File URLs and public ledger proof links support this storage; legacy disk evidence has a validated compatibility endpoint.
- Evidence responses use explicit types, `nosniff`, a sandbox content policy and safe content disposition. Public writes and verifier attempts have a bounded per-process/IP rate limit.
- The no-key fallback requires labeled invoice number, payout email, total and explicit currency. It no longer guesses $400, uses a heading as an invoice number, mistakes a line item for the total, defaults an unknown currency to USD, or claims evidence was verified.
- Missing or invalid extraction fields cannot silently inherit the registered vendor payout email. Gemini key fallback also works when the primary setting contains an example placeholder.

## Other corrections

- Financial inputs reject zero/negative, non-finite and fractional-cent values. Campaign currency, names, email addresses and collection sizes are validated. Cross-campaign vendor assignment is rejected.
- Frontend donation limits and simulation visibility respect their configuration. Failed captures display failure; unconfirmed payments block another checkout within the mounted form.
- Donation-page funding progress includes completed payouts, matching the other campaign pages.
- Theme changes follow system appearance and keep working without browser storage. Signing out clears the verifier key.
- API timestamps identify UTC explicitly. The health endpoint checks database connectivity. Startup uses a properly owned database session.
- Frontend response headers prevent framing and unsafe object embedding. Copy no longer promises PayPal escrow or an absolute guarantee of delivered work.
- Additive migration `003_invoice_document_hash.sql` upgrades existing PostgreSQL databases without deleting records. Existing line endings and dependency manifests/lockfiles are preserved.

## Verification

- Backend tests cover mocked PayPal failures, capture recovery, validation, storage, uploads and duplicate detection.
- Real PostgreSQL tests exercise concurrent approval/allocation/settlement, repeatable upgrades of an old schema, startup/seed, and an actual bundled invoice/proof upload through the API.
- Frontend checks: utility tests, ESLint, TypeScript and a Next.js production build.
- npm production-dependency audit reported zero known vulnerabilities. Python dependency consistency check passed.

## Boundaries retained from the prototype

The role selector remains browser demo state. Organizer/vendor submissions are public, and public invoices include verifier notes and evidence; the shared verifier key protects financial decisions. Production account authorization would require a separate workflow change. Rate limiting is per process, so a public multi-worker deployment needs shared/proxy limits and appropriate request timeouts. New uploads persist in PostgreSQL; old evidence still requires its original upload directory. Older records do not automatically gain document hashes or get financially reconciled by this change.

Actual PayPal Sandbox and Gemini calls were not exercised with account credentials. Provider behavior was tested using mocks; no real or Sandbox transfers were sent during validation. Refunds, disputes, regulatory compliance and live payments remain outside the project scope. Passing these checks is not a claim that every possible vulnerability has been eliminated.
