# StraightMoney

**A PayPal Sandbox prototype for transparent community fundraising & milestone-based startup pledges.** Donors fund verified campaigns and high-growth venture milestones, vendors submit invoices and delivery evidence, and independent verifiers approve eligible payouts directly to the vendor's registered PayPal account. Organizers never take custody of pooled funds. Built for the PayPal AI Hackathon; operates strictly in the PayPal Sandbox environment (no live real-money payments are supported).

---

## Architecture & How It Works

StraightMoney enforces strict separation of duties, deterministic policy gates, and multimodal AI verification before releasing funds.

```
       [ Donor ]                [ Vendor ]              [ Verifier ]
           │                        │                         │
     PayPal Orders v2         Uploads Invoice &           Reviews Evidence &
    (Sandbox Checkout)         Delivery Proof              Policy Results
           │                        │                         │
           ▼                        ▼                         ▼
   ┌───────────────┐        ┌───────────────┐         ┌───────────────┐
   │ Escrow Pool   │        │ Gemini Vision │         │ Deterministic │
   │ (PostgreSQL + │◄───────┤ Multimodal    │────────►│ 8-Point Policy│
   │ Row Locks)    │        │ OCR Extraction│         │ Engine        │
   └───────┬───────┘        └───────────────┘         └───────┬───────┘
           │                                                  │
           └──────────────────┬───────────────────────────────┘
                              ▼
                   [ PayPal Payouts v1 ]
             (Direct Vendor Batch Disbursement)
                              │
                              ▼
                   [ Transparent Public Ledger ]
             (Live Audit Trail + Gemini Natural Language Q&A)
```

| Lifecycle Step | Implementation & Safeguards |
| --- | --- |
| **1. Donate & Back** | Authentic PayPal Orders v2 checkout and capture for both Community Causes and Startup Hardware Milestones. Captured funds credit the campaign ledger upon verified `COMPLETED` capture status with idempotent duplicate prevention. |
| **2. Submit Invoice** | Assigned vendors upload invoice PDFs or images and photographic proof via interactive drag-and-drop dropzones with real-time size validation and image previews. |
| **3. Extract & Analyze** | Google Gemini multimodal Vision performs OCR to extract invoice metadata (vendor, invoice #, line items, totals, currency, dates). A phased real-time progress indicator updates the vendor during extraction. |
| **4. Policy Verification** | An 8-point deterministic Python policy engine evaluates business rules (campaign active, assigned vendor, registered payout email match, duplicate invoice check, remaining budget check, balance sufficiency for installments, currency match, and proof attachment). |
| **5. Independent Review** | Verifiers inspect extracted data side-by-side with raw documents, advisory flags, and policy verdicts in a WCAG AA-compliant frosted liquid-glass dashboard. Organizers and vendors cannot approve payouts. |
| **6. Disburse (Installments)** | Verifier-approved invoices trigger automated PayPal Payouts batches. If campaign funds are currently insufficient, payouts are queued into tracked installments funded as new donations arrive. |
| **7. Reconcile Webhooks** | Verified PayPal capture, refund, dispute, and payout item webhooks update ledger status with cryptographic signature verification. Conflicting records flag in the verifier workspace. |
| **8. Delivery Closeout** | After full payout, the vendor submits itemized delivery completion records; the campaign organizer accepts delivery or logs remaining issues. |
| **9. Reversals & Refunds** | Organizers can cancel campaigns to trigger full PayPal capture refunds to donors. PayPal dispute events place holds on available balances. |
| **10. Transparent Ledger** | The public ledger records all donation captures, payout transfers, and verified reversals with links to raw evidence. Visitors can query ledger history using conversational natural language powered by Gemini (`POST /campaigns/{id}/ledger/ask`). |

---

## Deterministic 8-Point Policy Engine

Before an invoice can reach a verifier for payout approval, it must pass eight strict deterministic checks:

1. **`CampaignActive`**: Campaign must be in `ACTIVE` state (not draft or closed).
2. **`VendorApproved`**: Vendor must be actively registered and officially assigned to the target budget line.
3. **`PayoutEmailMatch`**: Extracted payout email must match the vendor's pre-registered PayPal account email (case-insensitive).
4. **`NoDuplicate`**: Neither active nor rejected duplicate invoice numbers may exist for this vendor (plus document hash verification).
5. **`WithinBudgetLine`**: Payout claim cannot exceed the budget line's allocated remaining funds.
6. **`PoolHasFunds`**: Campaign balance must have available captured funds; allows partial installment scheduling if funds are pending.
7. **`CurrencyMatch`**: Invoice currency must strictly match the campaign currency (e.g., `USD`).
8. **`EvidenceAttached`**: Photographic proof of delivered goods or services must accompany the invoice (PDF alone is insufficient).

*Note: AI advisory outputs provide risk signals and line-item sanity checks to the verifier, but AI cannot independently authorize payouts.*

---

## Performance & Resource Optimization

StraightMoney is optimized for low compute, low memory, and minimal network overhead across both client and server:

### Frontend & Client-Side
- **On-Demand ag-Grid Code Splitting**: Extracted the ~500 KB `ag-grid-community` and `ag-grid-react` library into a lazy component (`LedgerAgGrid.tsx`) using `React.lazy` and `Suspense`. The default lightweight HTML table loads instantly; the heavy grid bundle is downloaded on demand only when the user selects "Interactive grid".
- **Image Optimization & Bandwidth Reduction**: Configured Next.js Image Optimization to automatically negotiate modern `image/avif` and `image/webp` formats, shrinking public illustration transfer sizes by 50–70%.
- **Edge & Browser Caching**: Enabled Gzip / Brotli payload compression (`compress: true`), 1-year immutable caching for local fonts (`Cache-Control: public, max-age=31536000, immutable`), 1-week revalidated caching for public images (`stale-while-revalidate`), and explicit `no-store` headers on API proxy endpoints.
- **Background CPU & Battery Conservation**: Connected carousel animations to the HTML5 Page Visibility API (`visibilitychange`). Timers are cleared (`clearInterval`) when tabs are backgrounded or minimized, preventing idle CPU cycles.
- **DOM Layout Thrashing Elimination**: Debounced `MutationObserver` layout measurements via `requestAnimationFrame` inside `SiteMotion.tsx`, batching bounding box computations.
- **Zero-CLS Font Loading**: Configured font loaders with `display: "optional"` to eliminate Cumulative Layout Shift (CLS) on initial paint.
- **GPU Animation Gating**: Wrapped continuous orb floats and stream animations inside `@media (prefers-reduced-motion: no-preference)`, respecting accessibility preferences and sparing mobile GPU compositing.

### Backend & Database
- **N+1 Query Elimination**: Converted O(N) lazy relationship round-trips into constant O(1) batched queries across all major endpoints (`/campaigns/{id}`, `/invoices`, `/campaigns/{id}/invoices`, `/campaigns/{id}/ledger`, and `/donations/{order_id}/updates`) using SQLAlchemy `joinedload` and `selectinload`.
- **High-Frequency Query Indexing**: Added explicit database indexes to foreign keys and lookup columns (`BudgetLine.vendor_id`, `Invoice.budget_line_id`, `Invoice.vendor_id`, `Donation.paypal_order_id`, and `AuditLog.campaign_id / invoice_id / action / timestamp`).
- **GenAI Client Singleton**: Replaced per-request client allocations in `advisory.py` and `extraction.py` with a module-level cached singleton, reusing existing HTTP/2 socket pools.
- **Database Connection Pooling**: Configured connection recycling (`pool_recycle: 1800`), explicit pool sizing (`pool_size: 10`, `max_overflow: 20`, and `pool_timeout: 30`) for PostgreSQL to prevent connection leaks under concurrent traffic.

---

## Security & Reliability Safeguards

- **Financial Integrity**:
  - Row-level database locks (`SELECT ... FOR UPDATE`) prevent race conditions during concurrent donations, claims, and payout approvals.
  - Strict enforcement of the PayPal Sandbox base URL (`https://api-m.sandbox.paypal.com`).
  - Idempotent transaction processing ensures webhooks and captures are never double-counted.
- **Strict Separation of Duties**:
  - Organizers cannot approve invoices; vendors cannot approve their own submissions.
  - Multi-role access control (Organizer, Vendor, Verifier, Donor) authenticated via secure password hashing and role-scoped session tokens.
- **File Upload Hardening**:
  - Magic-byte validation verifies PDF (`%PDF-`) and image signatures (`PIL.Image.verify`); invalid or disguised file types are rejected immediately.
  - SVG uploads are blocked to prevent Stored Cross-Site Scripting (XSS).
  - Evidence files are served with restrictive sandboxed headers (`Content-Security-Policy: sandbox; default-src 'none'`).
- **Data Protection & Sanitization**:
  - Downloadable CSV audit reports sanitize cells starting with `=, +, -, @` to neutralize formula injection attacks.
  - Rate limiting protects public endpoints against abuse (`MAX_UPLOAD_BYTES`, `MAX_PDF_PAGES`, `WRITE_RATE_LIMIT`).

---

## UI/UX Design System

- **VisionOS-Inspired Liquid-Glass**: Frosted glass panels (`backdrop-filter: blur(20px)`), glowing border states, and PayPal-branded accents (`#003087` Navy, `#0070BA` Blue, `#009CDE` Cyan, `#FFC439` Gold).
- **Startup Milestone Escrow & Backer Pledges**: Dedicated **Startups & Emerging** cause track (`/explore/startups`, `/explore/startups/[campaignId]`) with interactive venture case studies, direct **Back Milestone via PayPal** actions, and milestone-locked supplier disbursements.
- **Theme Switching**: Glare-free dark-mode and light-mode system with instant local storage persistence and system preference sync (`ThemeProvider`).
- **Interactive Role-Based Sign In**: Modern split-card layout with 4 distinct interactive role cards and dynamic real-time storytelling on the campaign's mission.
- **Rich File Upload Dropzones**: Drag-and-drop file targets with live preview thumbnails, badge indicators, and file-size validation.
- **Phased OCR Progress Feedback**: Dual-ring animated spinner with 3 live phased stage badges (Upload Artifacts, Gemini OCR Analysis, Policy Rule Evaluation) and elapsed duration counter.
- **Dynamic Campaign Budgeting**: Organizers can add, assign, and delete budget line items seamlessly before publishing.
- **WCAG AA Compliant**: High-contrast typography and glare-free dark-mode decision controls.

---

## Prerequisites & Installation

### Prerequisites
- **Python**: 3.11+
- **Node.js**: v20+ and npm
- **Docker & Docker Compose**: (for PostgreSQL)
- **PayPal Developer Account**: Sandbox client ID and secret ([developer.paypal.com](https://developer.paypal.com))
- **Google Gemini API Key**: ([aistudio.google.com](https://aistudio.google.com))

### 1. Environment Setup

Copy the environment templates and configure your keys:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
```

Key environment variables in `.env`:
- `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`: Your PayPal Sandbox credentials.
- `PAYPAL_BASE_URL`: `https://api-m.sandbox.paypal.com`
- `LLM_API_KEY`: Your Google Gemini API key.
- `LLM_MODEL`: Primary model (e.g. `gemini-1.5-flash` or `gemini-3.8-flash`).
- `VERIFIER_KEY`: Enrollment secret required to register a verifier account.
- `ADMIN_SETUP_KEY`: Setup secret to claim the seeded campaign.
- `DATABASE_URL`: PostgreSQL connection string (defaults to `postgresql+psycopg://straightmoney:change-me@localhost:5432/straightmoney`).

On startup, the API automatically applies additive, idempotent migrations in [`backend/migrations/`](backend/migrations/) to existing PostgreSQL databases.

### 2. Start PostgreSQL

Launch the database container:

```powershell
docker compose up -d
```

### 3. Start the Backend API

From the `backend` folder:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- API Base: <http://localhost:8000>
- Health Check: <http://localhost:8000/health>
- Interactive OpenAPI Docs: <http://localhost:8000/docs>

### 4. Start the Frontend Application

From the `frontend` folder in a new terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000> in your browser.

---

## Automated Testing & Verification

### Frontend UI & Interaction Tests
Runs the test suite verifying spring animations, state machines, role routing, and financial UI invariants:

```powershell
npm --prefix frontend run test:ui
```

### Frontend Type Safety & Production Build
Compiles all routes, validates TypeScript types, and verifies production bundle generation:

```powershell
npm --prefix frontend run build
```

### Backend Deterministic Policy Tests
Runs the 39-point unit test suite validating all policy gates:

```powershell
backend\.venv\Scripts\python -m pytest backend/tests/test_policy.py -v
```

### Optional Live Sandbox CLI Tests
Exercise actual PayPal Sandbox checkout and payout calls (requires valid Sandbox buyer/seller credentials):

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/donate_test.py
.\backend\.venv\Scripts\python.exe backend/scripts/payout_test.py vendor@example.com
```

---

## Interactive Demo Walkthrough

1. **Explore the Campaigns**:
   - Visit <http://localhost:3000> to view the seeded **School Library Corner** campaign ($1,200 goal, 3 budget lines: shelves, books, paint).
   - Click **Donate with PayPal** to complete an authentic PayPal Sandbox checkout capture. Watch the progress bar and ledger update in real time.
2. **Startup Milestone Escrow & Backer Pledges**:
   - Switch to the **Startups & Emerging** tab on the home page or navigate to `/explore/startups` to explore the live venture pilot for **AeroDrone Ag** ($12,500 milestone pool).
   - Click **Donate via PayPal &rarr; Back Startup Milestone** to pledge capital into the PayPal Sandbox escrow balance. Funds are held safely in escrow and disbursed directly to precision hardware suppliers (airframe machining, brushless motors, multispectral sensors) only upon verified delivery milestones.
3. **Organizer Setup**:
   - Go to `/signin`, choose the **Organizer** role, and create an account.
   - Claim the seeded campaign using `ADMIN_SETUP_KEY` or create a new campaign with custom budget lines.
   - Generate a Vendor Invitation token for a designated budget line.
4. **Vendor Submission**:
   - On `/signin`, create a **Vendor** account with the invitation token and assigned payout email.
   - In `/vendor`, select the assigned budget line, drag-and-drop an invoice PDF/image and proof photo, and click Submit.
   - Watch the live phased progress indicator as Gemini extracts invoice items and the policy engine runs.
5. **Verifier Approval**:
   - Register a **Verifier** account on `/signin` using the private `VERIFIER_KEY`.
   - Open `/verifier` to inspect the invoice, AI advisory notes, and policy results. Click **Approve Invoice**.
   - The backend schedules and executes a PayPal Payouts batch.
6. **Auditing & Closeout**:
   - Inspect `/ledger/1` to verify the public immutable transaction ledger and download the sanitized CSV report.
   - Ask Gemini questions about ledger activity (e.g. *"How much has been paid to the book vendor so far?"*).
   - In `/vendor`, complete the delivery report; in `/organizer`, accept the delivery to close out the budget line.

---

## Project Structure

```
StraightMoney/
├── backend/
│   ├── advisory.py          # LLM advisory risk checks & ledger Q&A (singleton GenAI client)
│   ├── audit.py             # Immutable audit logging
│   ├── auth.py              # Role-based sessions, cookie security, registration
│   ├── config.py            # Pydantic Settings & environment variables
│   ├── db.py                # Database connection pooling & session management
│   ├── extraction.py        # Gemini multimodal OCR & invoice data extraction
│   ├── finance.py           # Balance calculation & refund tracking
│   ├── guards.py            # Upload size limits & rate limiting middleware
│   ├── installments.py      # Automated installment queue & payout execution
│   ├── main.py              # FastAPI application & optimized REST endpoints
│   ├── models.py            # SQLAlchemy database models with optimized indexes
│   ├── payments.py          # PayPal Sandbox Orders & Payouts REST client
│   ├── policy.py            # Deterministic 8-point policy verification engine
│   ├── reconciliation.py    # PayPal webhook verification & dispute reconciliation
│   ├── schemas.py           # Pydantic input/output validation models
│   ├── seed.py              # Demo campaign seed data
│   └── tests/               # Backend policy, webhook, installment & unit tests
│
├── frontend/
│   ├── app/                 # Next.js App Router (home, explore, campaigns, ledger, signin, workspaces)
│   ├── components/          # Liquid-glass UI components (Header, LedgerGrid, LedgerAgGrid, etc.)
│   ├── lib/                 # Client API client, presentation utilities, demo sessions
│   ├── public/images/       # Public campaign illustrations & media
│   └── tests/               # Node test runner interaction & UI invariance suite
│
├── docker-compose.yml       # PostgreSQL database container configuration
└── SPEC.md                  # Hackathon technical specification & architecture requirements
```

---

## License

MIT License. See [`LICENSE`](LICENSE).
