# Hosted payments and app confirmation

Work stays on `codex/expo57-mobile-fixes`. Do not merge into `main` to test this.

## Current implementation

Profile links to Membership, Support Thabaat, Payment History, and (development builds only, explicit environment opt-in) the $1 internal Payment Check. Checkout opens CharityStack's hosted website in the system browser sheet. Closing the sheet returns to the app, which refreshes its private server records. The internal check also refreshes on foregrounding, offers a status-refresh button, and polls at 15-second intervals for one minute while focused. Reopening the app reloads the same checkout record. Confirmed, failed, and refunded attempts cannot open another checkout from that screen.

An internal checkout record is created before opening the website. The database assigns the $1 expectation and fixed test form, reuses the existing record, and prevents clients from modifying payment status. Only a trusted server/operator can write provider verification. Browser results and URL parameters cannot mark a payment complete. No automated CharityStack verification or redirect is deployed yet. Closing the browser sheet is the currently implemented return action.

The membership/catalog/history screens read database records with row ownership policies. Paid memberships are deliberately unavailable until both commercial terms and verified entitlement activation are implemented. No invented pricing or membership benefits are seeded. Donation campaigns can be configured by the team, but none are seeded and history import is not automatic. An expired membership loses its displayed active status even if the stored status is still active. Cancelling renewal preserves access only through the recorded end date.

## Database setup (staging first)

After the existing schema and `20260921_prototype_integrity.sql`, apply `thabaat-mobile/database/migrations/20260928_membership_billing.sql`. The migration is repeatable, adds new tables, and does not modify existing registrations or grant paid access. It was applied successfully to the hosted staging project on September 28, 2026 (SQL Editor reported success). Check the target project is **qyxggeyqbebezlolvztf**, not the original team project. Never expose Supabase service-role credentials in Expo environment variables.

No mobile client may write membership status, paid amounts, provider references, or campaign totals. The SQL policies and privileges enforce this independently of the UI. Catalogue publication is an administrator/server operation. Published hosted donation URLs must be HTTPS CharityStack `/donate/{id}` or `/attend/{id}` URLs without embedded credentials or redirect parameters.

## What blocks automatic live confirmation

CharityStack documents API keys as administratively provisioned, with no self-service key dashboard. The current workspace has no CharityStack API key, webhook secret, or configured server credentials. See [authentication](https://www.charitystack.com/docs/authentication).

The provider must confirm the reliable correlation field between a hosted checkout and its resulting payment/subscription. The documented [checkout-link endpoint](https://www.charitystack.com/docs/api/forms/create-checkout-link) returns a link ID, while the documented [payment response](https://www.charitystack.com/docs/api/payments/get) does not establish that link-to-payment mapping. Do not infer ownership from a browser return, user-supplied payment ID, amount, or email alone. A prefilled editable custom field is not a guaranteed immutable mapping.

Ask the CharityStack account administrator for the existing API integration (do not rotate a key that other integrations use), necessary payment/form/subscription read permissions, webhook setup access, and the supported checkout-reference and app-return mechanism. Do not paste keys into chat or put them in `EXPO_PUBLIC_*`.

Suggested support request (not sent):

> We are integrating the Thabaat iPhone app with hosted CharityStack checkout. We need a server-created checkout reference that is returned unchanged in verified payment/subscription events, event-ticket payment coverage, a supported return/deep-link URL, and API/webhook access for the organization. Please provide the exact payload contract and supported test environment. We need to verify the payment amount, currency, form, frequency, payer-to-app order binding, and terminal status before granting membership or tickets. Does the prefilled link ID appear in payment retrieval and signed events, and is that mapping immutable?

After access is available: create a checkout on the backend, persist the provider mapping, verify raw-body HMAC webhooks with timestamp tolerance, reconcile via the API, deduplicate on provider payment ID, and atomically write the checkout result plus its specific entitlement/history record. Handle delayed events, cancellation, renewal, failed payment and refunds. Register the supported return URL; the app must always read server status after returning. Deploy to staging before enabling paid plan buttons.

## Verification

Local automated checks exercise repeated migrations, checkout reuse, anonymous denial, account isolation, prevention of forged paid status/membership/history, membership expiry, and checkout URL validation. Browser UI checks verified pending → confirmed, refund status after reload, disabled repeat checkout after a final result, and the membership/donation/history empty states using a **local synthetic fixture**. These checks cannot establish that any real payment succeeded. Typecheck, lint and all 69 automated tests passed. The fixture's `__fixture/payment-status` endpoint exists only in the local test server; it is never deployed or connected to Supabase/CharityStack.

A real acceptance test still requires the integration above: user opens the app, starts the internal $1 checkout, personally pays once, returns, and sees the matching provider-verified result in the app. Verify the corresponding CharityStack dashboard payment, delayed webhook handling, app restart, duplicate return and webhook delivery, and cancelled checkout without another charge. The existing test form has only one ticket and may be sold out after use. Do not charge again to troubleshoot an unverified state.

## Backlog traceability

Source: [Thabaat_Backlog_Gantt_(Updated).xlsx](https://docs.google.com/spreadsheets/d/1Nu81wLjYpdJuLvlKC2lGlSGEH-NuWgBS/edit), Stakeholder Build Backlog / Stakeholder Gantt Chart, inspected September 28, 2026; and the supplied Master Requirements List.

UC2 tasks 49–60 describe plans/status, one-time and recurring purchases, renewal/cancellation, upgrades/downgrades, expiry, gated content/events, discounts and complimentary access. UC3 task 73 covers paid event tickets. UC5 tasks 97–107 cover donations, recurring giving, campaigns, progress, history, receipts and administration. This change establishes the app views and private records; it does **not** mark those full use cases complete. The Gantt's completed labels are not proof of payment implementation in the accessible repository. Admin tooling, provider synchronization, entitlement enforcement for content/events, refunds and purchase lifecycle remain outstanding.

### Isolating the UI fixture with Expo 57

Expo 57 development transforms can import `.env.local` into client modules even when shell variables or `EXPO_NO_DOTENV` are set. Do not assume an environment override has isolated a test. For this browser test we used a temporary copy without environment files and explicitly pointed that copy's `lib/supabase.ts` to `http://127.0.0.1:54329` with the synthetic key `local-e2e-key`. The real application's Supabase configuration was not changed. Verify the screen says **Local fixture community event** and profile says **Local Demo** before simulating payment results. Never send fixture state updates to hosted staging or production.
