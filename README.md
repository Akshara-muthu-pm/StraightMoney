# StraightMoney

**A PayPal Sandbox prototype for transparent community fundraising.** Donors fund a campaign, vendors submit invoices and delivery evidence, and a verifier approves eligible payouts to the vendor's registered PayPal account. The organizer does not receive a payout through the app. Built for the PayPal AI Hackathon; no live payments are supported.

## Current state

The repository contains a FastAPI backend and Next.js frontend, backed by PostgreSQL. On first startup, the API creates its tables and seeds a **School Library Corner** campaign with a $1,200 goal and three budget lines: shelves ($400), books ($600), and paint ($200). The UI includes campaign and donation, organizer, vendor submission, verifier, and public ledger pages.

| Step | Implementation |
| --- | --- |
| Donate | PayPal Orders v2 checkout and capture, or an explicitly enabled simulated donation for local demos |
| Submit | Vendor uploads a PDF or image invoice and optional proof photo |
| Extract and review | Gemini extracts invoice fields and provides advisory flags; eight Python policy checks decide whether the invoice can reach the verifier |
| Approve and pay | A verifier approves or rejects; approved invoices use PayPal Payouts in tracked installments as captured funds become available |
| Inspect | The public ledger shows donation records and confirmed payouts, with links to uploaded evidence where available |

The eight policy checks cover campaign status, assigned vendor, registered payout email, duplicate invoice number, remaining budget, available funds, currency, and attached proof. The funds check reports how much is available for the first installment; a short balance does not prevent approval. Advisory AI output cannot independently approve a payout.

After an Orders v2 capture response, the API reads `purchase_units[0].payments.captures[0].status`. It credits the campaign only for `COMPLETED`, once per order. `PENDING` leaves the donation uncredited; a repeat call to the capture endpoint checks the existing order without submitting a second capture. Other capture statuses are recorded as failed with the PayPal status saved in `paypal_capture_status`. The two `.env.example` files describe the existing Sandbox settings; capture verification needs no new environment variable.

**Sandbox test override:** The verifier UI has an explicit test action that can approve an invoice despite failed policy checks. It is enabled by default in the example configuration and only works with the PayPal Sandbox base URL. It records an audit event and routes to the vendor's registered email. Set `ENABLE_VERIFIER_TEST_OVERRIDE=false` and `NEXT_PUBLIC_ENABLE_VERIFIER_TEST_OVERRIDE=false` to hide and reject it when testing the normal policy flow.

## Run locally

Prerequisites: Python 3.11+, Node.js and npm, and Docker Compose. A Gemini API key enables AI invoice extraction and advisory checks; without one, text PDFs can use a strict fallback that reads labeled invoice number, payout email, total and currency. Missing fields and image invoices require manual review; the fallback never invents amounts or verifies delivery. PayPal Sandbox credentials are needed to exercise actual Sandbox checkout and payout calls; the app also has simulation paths for local demonstrations.

1. From the repository root, copy the environment examples and edit the copies:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item frontend/.env.example frontend/.env.local
   ```

   Set a PostgreSQL password in `.env` and use the same value in `DATABASE_URL`. For PayPal Sandbox, set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env`. Checkout redirects to PayPal's Sandbox approval page and returns to `FRONTEND_URL/donate/paypal-return`, where the API confirms capture before crediting the campaign. Set `FRONTEND_URL` to the browser-accessible frontend origin (normally `http://localhost:3000`). Set `LLM_API_KEY` to your Gemini key and choose an available `LLM_MODEL`. Keep `PAYPAL_BASE_URL` on the Sandbox URL. The frontend API URL defaults to `http://localhost:8000`.

   Set `VERIFIER_KEY` to a private value in the backend `.env`, then enter it once on `/verifier`; the browser keeps it in that tab's session storage and sends it only for approve, reject, retry, and the test override. `MAX_DONATION_AMOUNT` defaults to 5000 and is enforced by the API. Match `NEXT_PUBLIC_MAX_DONATION_AMOUNT` in the frontend for the form limit. `ALLOW_SIMULATED_DONATIONS` defaults to `false`; set it and `NEXT_PUBLIC_ALLOW_SIMULATED_DONATIONS` to `true` only when you want the explicit simulated donation control. The public frontend variables are display settings, not security controls.

   On startup, the API applies the additive, idempotent donation migrations in [`backend/migrations/`](backend/migrations/) to existing PostgreSQL databases. New databases receive the columns when tables are created.

2. Start PostgreSQL from the repository root:

   ```powershell
   docker compose up -d
   ```

3. Start the API from `backend`:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

   The API is at <http://localhost:8000>, its health endpoint at <http://localhost:8000/health>, and interactive docs at <http://localhost:8000/docs>. Start it from `backend` so the default upload directory resolves there.

4. In a second terminal, start the UI:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

   Open <http://localhost:3000>. Set `NEXT_PUBLIC_USE_MOCKS=true` in `frontend/.env.local` for a frontend-only preview; that mode does not persist actions. With mocks off, the UI uses the FastAPI backend.

## Demo flow

1. Open the seeded campaign and capture a Sandbox donation, or enable simulated donations in both environment files and use **Simulate donation without PayPal deduction** for a local demo. Simulated records carry a **SIMULATED** label on the campaign page and public ledger.
2. Open `/vendor`, select the campaign and budget line, and upload an invoice plus a proof photo. For meaningful AI extraction, configure Gemini. Extraction errors leave the invoice needing review.
3. Open `/verifier`, enter `VERIFIER_KEY` once for the browser tab, and inspect extracted fields, policy checks, advisory flags, and evidence. Approve a passing invoice or reject it.
4. Check `/ledger/1` for captured donations and successful payouts. If the campaign has less than the approved invoice amount, later captured donations can trigger the remaining installment.

Payouts are only counted as paid after PayPal confirms success. A simulated payout is recorded as failed and does **not** reduce the campaign balance or claim that the vendor received money. If a Sandbox sender gets `403 PAYOUT_NOT_AVAILABLE`, use a Payouts-enabled Sandbox Business account from a supported sending country, restart the API with that account's credentials, and use **Retry payout** on the invoice. A failed transfer does not reduce the balance.

## Verification

From `backend`, run the automated tests with the installed environment:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

From `frontend`, run:

```powershell
npm run lint
npm run build
```

The optional live Sandbox CLI scripts require real Sandbox credentials and an interactive buyer approval or eligible payout recipient. Run them from the repository root using the backend virtual environment:

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/donate_test.py
.\backend\.venv\Scripts\python.exe backend/scripts/payout_test.py vendor@example.com
```

## Repository notes

- Backend: `backend/main.py` exposes the API; `policy.py` contains deterministic checks; `installments.py` manages payout state; `payments.py` calls PayPal; `extraction.py` and `advisory.py` call Gemini.
- Frontend: `frontend/app` contains the routes; `frontend/lib/api.ts` is the typed API client.
- `docker-compose.yml` starts PostgreSQL. Tables are created with SQLAlchemy `create_all`; existing PostgreSQL databases receive the additive, idempotent SQL migrations in `backend/migrations`.
- [`SPEC.md`](SPEC.md) describes the intended product. [`docs/demo-script.md`](docs/demo-script.md) has the reset checklist, scenario run, and video script; [`sample_invoices/`](sample_invoices/) contains fake invoices and proof illustrations. Submission screenshots are still to be added.
- This is a hackathon prototype. The API has no user authentication or role enforcement, and new invoice and proof uploads are stored in PostgreSQL and served publicly from `/files`; validated legacy files remain available from `/uploads`. Use synthetic demo data and Sandbox credentials only.

## Payment and upload safeguards

Approval rechecks current policy and commitments under a database lock. Duplicate checks use the extracted invoice number and a document hash for new uploads. Payout reservations exclude simulated donation balances, so demo donations cannot fund actual Sandbox transfers. Unknown captures and uncertain payout responses remain retryable using the same payment key; confirmed settlements cannot be counted twice.

Uploads are limited to 10 MiB each, 20 PDF pages, and 20 million image pixels. File contents determine the stored type and extension; proof must be a valid JPEG, PNG or WEBP. Invalid file formats are rejected before processing. New evidence is stored in PostgreSQL, while old disk-backed evidence still requires its original upload directory. Back up both when retaining legacy records.

Public write endpoints have a per-process limit of 30 requests per minute per source IP. Configure `MAX_UPLOAD_BYTES`, `MAX_PDF_PAGES` and `WRITE_RATE_LIMIT` if needed. An Internet-facing deployment also needs reverse-proxy body/time limits and a shared rate limiter across workers.

This remains a Sandbox prototype: demo role selection is not account authentication, organizer/vendor submissions are public, and invoice details, verifier notes and evidence are public. The verifier key protects financial decisions. PayPal captures funds in the merchant Sandbox account; the campaign balance is application bookkeeping, not a PayPal escrow product. Refunds, disputes, account-level authorization and production compliance remain outside the demo scope.

Optional PostgreSQL locking and migration tests require a disposable test database (the suite creates and drops isolated schemas):

```bash
TEST_POSTGRES_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/TEST_DB python -m pytest -q tests/test_postgres_concurrency.py
```

Run that command from `backend`; use local test credentials, never a production database.

## License

MIT. See [`LICENSE`](LICENSE).
