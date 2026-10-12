# CharityStack backend setup — September 29, 2026

All code stays on `codex/expo57-mobile-fixes`; main is unchanged. No support reply, webhook registration, credential rotation, real charge or hosted deployment was performed for this update.

## What is ready

- `POST /payments/checkout` requires a Supabase bearer session and only accepts `{ "orderId": "<uuid>" }`. It reads the caller's pending order, event date, form, price and configured ticket from the database. It uses the authenticated account email to prefill a server-created CharityStack link. The app never supplies a price or another user's email.
- The link is stored and reused. A database uniqueness constraint prevents simultaneous requests from creating several links. A timeout or ambiguous provider response leaves the order's link in `needs_review`; automatic retries are blocked. A crash can leave `creating`, which also needs operator review. Neither state means a charge occurred.
- `POST /payments/charitystack/webhook` verifies the raw-body HMAC-SHA256 and a five-minute timestamp window before parsing. It saves the signed event in a private inbox before acknowledging receipt. Exact payload replays are deduplicated by body hash and environment, independent of the unsigned delivery ID header. Database failures return 503 so the provider can retry.
- `thabaat://paid` opens a payment-status screen and reads the signed-in user's saved order. Payment IDs and success flags in the URL are ignored. Signed-out users must sign in and revisit payment history/checkout. CharityStack does not redirect here yet.
- The current hosted manual test remains available with `EXPO_PUBLIC_SERVER_CHECKOUT=false`.

**No automatic grants:** inbox rows remain `needs_review`; there is no background reconciliation worker. Email/form/amount/time matching can help an operator investigate, but editable email or a returned payment ID is not sufficient ownership proof. Signed events prove provider origin, not the app purchaser's identity. Use the existing [independent manual verification procedure](PAID_EVENT_TEST.md). Membership lifecycle, refunds and recurring billing automation remain unfinished.

## Enable in an isolated provider test environment

1. Obtain test credentials and the exact test API base URL privately from the organization/provider. Do not replace or rotate Omar's existing live key. No keys belong in Git or `EXPO_PUBLIC_*`.
2. Apply `thabaat-mobile/database/migrations/20260929_charitystack_transport.sql` after the migrations in [TEAM_SETUP.md](TEAM_SETUP.md). This update has only been applied in isolated local tests, **not hosted staging**. It adds private checkout-link and webhook-inbox tables without changing entitlements.
3. Create/verify the corresponding form in the provider's test environment. Configure the app ticket's `paid_event_checkout_configs` row with that test `form_id`, `provider_mode='test'`, and the exact provider `provider_ticket_name`. Existing configurations default to `live`, with no ticket name, and fail closed. Test and live configurations must use separate orders/databases; do not repoint an existing pending live order. Use a fresh isolated test database or a separate event/order.
4. The form must include the purchaser field titled exactly **Thabaat app checkout reference**. The backend prefills this field, the ticket name, account email, amount and one attendee email. These remain editable provider inputs; final verification must check the actual purchase.
5. Fill the backend-only environment variables in `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CHARITYSTACK_ENABLED=true`, `CHARITYSTACK_MODE=test`, `CHARITYSTACK_API_KEY=cs_test_...`, and the provider-confirmed HTTPS `CHARITYSTACK_API_BASE_URL` ending in `/v1`. A missing base URL or mismatched key prefix fails startup. No requests are sent while disabled.
6. Run `npm ci`, `npm test`, `npm run build`, then deploy the backend with HTTPS and the same isolated Supabase project as the app. Before live use, review payload retention/access: webhook payloads contain donor information and are server-only. They are not printed in logs or returned to the app.
7. Register the public HTTPS `/payments/charitystack/webhook` endpoint with CharityStack using their documented `POST /v1/webhooks`. Save the returned secret privately as `CHARITYSTACK_WEBHOOK_SECRET`. Do not register a webhook before the migration, endpoint and secrets are ready. Start with `donation.created` and `donation.updated`; review them manually. Registration is not automated by this change.
8. Set the mobile `EXPO_PUBLIC_BACKEND_URL` and opt in with `EXPO_PUBLIC_SERVER_CHECKOUT=true`. Reload Metro. If server checkout fails, the app does **not** fall back to a live form. The existing internal paid-event screen is still labeled as a real $1 test; do not present it as sandbox until the provider test environment and UI labeling are verified together.

The documented hosted URL is `https://charitystack.com/attend/{formID}?elementid={linkID}`. Both server and app validate the host, form and sole `elementid` parameter. If the provider test environment uses another host, it will be rejected until that exact provider-confirmed host is reviewed and supported. Do not disable URL validation to get around this.

## Provider contracts and remaining work

- [Create checkout link](https://www.charitystack.com/docs/api/forms/create-checkout-link): implemented using its published fields. `returnUrl` is deliberately omitted until the proposed feature is available and documented.
- [Webhook signature verification](https://www.charitystack.com/docs/guides/webhook-verification): implemented against timestamp plus exact body bytes.
- [Payment retrieval](https://www.charitystack.com/docs/api/payments/get): currently returns form **name**, not an immutable app order association. A returned payment ID alone does not fix this. Verify the provider association contract before building automatic access grants.

After provisioning, verify actual webhook envelopes, ticket/frequency/fee semantics, environment identifiers and supported callback query fields in the sandbox. Then implement API reconciliation, immutable order ownership binding, transactional fulfillment, refund/cancellation handling and subscription lifecycle before enabling automatic paid access. No API keys or test environment were supplied in the support reply, so these live checks are pending.

## Validation

Run backend `npm test` and `npm run build`; mobile `npm run typecheck`, `npm run lint`, `npm test`. Tests cover tampered signatures, expired timestamps, duplicate payloads, persistence failures, cross-account orders, test/live mismatch, ambiguous checkout retries and forbidden checkout URLs. Database tests apply the new migration twice and verify app accounts cannot read provider payloads. These are local fixtures, not proof of a provider transaction or iPhone return.

If a link stays `creating`/`needs_review`, inspect the provider's link list using the internal `Thabaat order <uuid>` label. Do not blindly delete the database claim or send another POST: the provider may have created the link before the timeout. Resolve the existing link and record its verified URL/ID, or establish that no link exists before an operator resets the claim. Pending seat holds still follow the limitations in the paid-event test guide.
