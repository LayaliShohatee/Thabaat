# Paid-only iPhone event test

This is a **real $1 payment with manual verification**, in the isolated staging app. It is not an automatic payment integration and does not provide admission to a real-world event. No real payment has been made or approved as part of the implementation checks.

## What is ready

- Event: **[STAGING] $1 Paid Access Test**, with one paid ticket and no free ticket option.
- CharityStack form: [Thabaat App — Paid Access Test](https://charitystack.com/attend/5451350b-cef4-4e59-8240-aa457d4f7c7e). We reused the separate internal test form created for this project; other organization forms were not changed.
- The hosted form asks for the required **Thabaat app checkout reference**, collected from the purchaser. This supports human reconciliation; it is not treated as immutable provider authentication.
- The app creates a pending order, holds the single test seat, and opens CharityStack. Returning does not unlock a ticket.
- An authorized operator checks the real payment in CharityStack, then uses a restricted database function to confirm it. Confirmation atomically creates the registration and payment-history row.
- The app refreshes its own order after returning/foregrounding and offers **Refresh payment status**. It polls every 15 seconds for the first minute on the checkout page.
- Verified status reveals **Open paid event access**; the ticket also appears in **My Events**. Private content is protected by database row policies, not just a hidden button.

## Team setup

1. Follow [TEAM_SETUP.md](TEAM_SETUP.md) for cloning `codex/expo57-mobile-fixes`, Node dependencies, environment files, Supabase auth, and installing the Expo 57 iPhone development build. Do not merge into `main` to test.
2. Use the isolated staging project **qyxggeyqbebezlolvztf**. Keep the original hosted team project separate.
3. On a fresh database, apply `thabaat-mobile/database/schema.sql`, then these migrations in order:
   - `20260921_prototype_integrity.sql`
   - `20260928_membership_billing.sql`
   - `20260928_paid_event_test.sql`
4. In staging only, apply `thabaat-mobile/database/paid_event_test_seed.sql`. The migration and seed were successfully applied to the above staging project on September 28, 2026. Do not rerun the fresh schema on an existing database. Do not rerun the older integrity migration after the paid-event migration; the newer migration updates the registration validator.
5. Set `EXPO_PUBLIC_ENABLE_PAYMENT_CHECK=true` in the mobile developer's ignored `.env.local`. It is an opt-in development feature; release builds block the checkout route.
6. From `thabaat-mobile`, run `npm ci`, then `npx expo start --dev-client`. Reload the installed development app on the iPhone. This change adds no native modules; an SDK 57 development build with the existing WebBrowser module is sufficient. The Mac and phone must be able to reach Metro.

The test event ID is `71000000-0000-4000-8000-000000000001`; the ticket ID is `72000000-0000-4000-8000-000000000001`. The seed creates a date 30 days after first application and deliberately does not reset it or inventory on later runs. A second team's environment needs its own explicitly approved checkout form/configuration; do not have multiple teams share the single live test ticket unintentionally.

## What to do on the iPhone

1. Sign in, then open **Profile → Paid Event Test · $1 real payment**, or find **[STAGING] $1 Paid Access Test** in the event feed.
2. Tap **Register for Event → Continue to $1 paid test → Prepare $1 checkout**.
3. Press and hold the generated checkout reference to copy it. The status should be **Awaiting manual payment verification**; there should not be a confirmed ticket yet.
4. Tap **Open CharityStack · Pay once**. Select one internal test ticket if the website asks. Enter the app checkout reference in the matching field and use the email shown in the app.
5. The account owner personally reviews the final total/fees and decides whether to pay. This is live, so do not use test card numbers. Never share card details with the project team or paste them into chat.
6. After one successful payment, close the browser sheet to return to Thabaat and tell the operator that payment is complete. Do not pay again if verification is delayed.
7. After the operator confirms the payment, tap **Refresh payment status → Open paid event access**. Check **My Events** and **Payment History** as well. Restart/reopen the app to confirm access persists.

The CharityStack banner currently says donations can still be accepted while Stripe has outstanding account requirements. That is not proof of payout approval or a successful charge. The provider's checkout/dashboard is authoritative for actual payment status.

## Operator verification — never run from the mobile client

Only approve after independently opening the actual CharityStack dashboard payment. Do not approve from a user screenshot, a browser return, or a typed payment ID alone.

Verify the dashboard record is completed (not pending/failed/refunded), belongs to form `5451350b-cef4-4e59-8240-aa457d4f7c7e`, represents the $1 USD ticket (separate any extra provider fees), and has the purchaser's app checkout reference and account email. Inspect the corresponding pending app order/profile and payment time. Resolve any mismatch before proceeding. The app reference is editable checkout input, so a human must verify the whole record; it is not sufficient by itself.

In the **staging** SQL Editor, inspect only the specific supplied order:

```sql
select o.id, o.status, o.amount_cents, o.currency, o.form_id,
       o.created_at, p.email
from public.paid_event_orders o
join public.profiles p on p.id = o.user_id
where o.id = '<APP_CHECKOUT_REFERENCE>'::uuid;
```

After verification, call the restricted function using actual dashboard evidence:

```sql
select public.confirm_paid_event_manually(
  '<APP_CHECKOUT_REFERENCE>'::uuid,
  '<ACTUAL_CHARITYSTACK_PAYMENT_ID>',
  100,
  'USD',
  '5451350b-cef4-4e59-8240-aa457d4f7c7e',
  '<Operator name, verification time, and concise checks performed>'
);
```

This function **does not contact CharityStack**. It records an operator's already-completed verification. Only a privileged server or database operator can execute it; anonymous and authenticated app roles cannot. It checks the expected amount/currency/form, requires a verification note and unique payment ID, preserves capacity checks, and rejects reuse across orders. Repeating the same valid approval returns the existing registration instead of creating another ticket. Keep service-role credentials out of the app.

If a pending checkout is abandoned, its seat stays held for this controlled test. Do not automatically release it: first verify no charge exists and handle any in-flight provider checkout. No automated expiration, refunds, subscription management, or production reconciliation is implemented. A refund must be processed separately in CharityStack and the app records reconciled by an operator; changing app status never sends money back. A refunded order loses private access under the access policy, but the existing registration/history also need reconciliation. Never mark a refunded/cancelled payment completed again to test a UI.

## Evidence and remaining work

- Mobile typecheck and lint pass; **84 automated tests pass**.
- Database tests cover paid-only inventory, pending-order reuse, anonymous denial, blocked self-approval, payment mismatches, payment ID reuse, account isolation, atomic ticket/history creation, refund access revocation, capacity/date checks, and unchanged free registrations.
- An isolated local browser fixture demonstrated **locked → pending → simulated confirmed → private access**, plus a confirmed My Events ticket. Synthetic fixture updates did not touch CharityStack or hosted Supabase.
- The live staging migration and paid-only event/configuration are installed. The real iPhone checkout-payment-verification-unlock test still awaits the user making a payment and the operator checking it.
- Automatic verification remains blocked on CharityStack API/webhook access and a supported reliable order mapping. The support request was sent on September 28, 2026. See [PAYMENTS_INTEGRATION.md](PAYMENTS_INTEGRATION.md).

Local fixture reproduction: use the isolated copy workflow in PAYMENTS_INTEGRATION.md, start `FIXTURE_PAID_EVENT=true node tests/fixtures/supabase-server.mjs`, and use Local Demo. After preparing a fixture order, the local-only `POST /__fixture/paid-event-status` body `{"status":"completed"}` simulates an operator result. This endpoint is not part of the app/backend deployment and must never be used as real payment evidence.
