# Release verification — 10 November 2026

## Automated checks

| Check | Result |
| --- | --- |
| Next.js production build (`npm run build`) | Passed outside the restricted filesystem runner; 16 pages generated. |
| Backend suite with `TEST_POSTGRES_URL` set to the local PostgreSQL database | 174 passed, including six PostgreSQL concurrency, migration, startup, and sample-upload tests. Each PostgreSQL test creates and drops its own disposable schema. |
| Frontend UI tests and ESLint | 22 tests passed; lint passed. |

The build can intermittently fail with `EPERM` while writing `frontend/.next` inside the restricted runner. The same source built successfully outside that restriction. The backend suite similarly needs local socket access for FastAPI's test client.

## PayPal Sandbox checks

| Step | Result |
| --- | --- |
| OAuth using configured Sandbox credentials | Passed. No token or secret was printed. |
| Frontend and backend PayPal client IDs | Match. Frontend mock mode is off. |
| OAuth payout scope | Advertised by PayPal. This does not prove a payout can complete. |
| Orders v2 create | Passed. A $10.00 USD test order was created: `9MU722248E011723R`. |
| Buyer approval and capture | Pending buyer approval; the order was last observed as `CREATED`. |
| Payout creation and confirmed receipt | Pending a valid Sandbox vendor recipient email. |
| Live webhook signature and event reconciliation | Not run; `PAYPAL_WEBHOOK_ID` is unset. Automated webhook tests passed with test doubles. |

The live order is separate from the application's campaign ledger. It must be approved by a Sandbox buyer before attempting capture. No payout or live webhook event has been claimed as complete.
