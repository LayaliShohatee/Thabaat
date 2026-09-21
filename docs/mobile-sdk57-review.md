# Expo SDK 57 and mobile prototype review

Reviewed September 21, 2026 against main `abba4c61610096c6eb518819d553641cd3d3c29c`, the mobile/backend code, and the supplied project requirements. All four existing feature branches were already ancestors of that main commit.

For the complete beginning-to-end environment and iPhone instructions, use [TEAM_SETUP.md](TEAM_SETUP.md).

## Resulting behavior

- Expo SDK 57 with aligned React Native 0.86.3 / React 19.2.3 packages, development-client support, and Xcode 27 scene compatibility.
- Visible account-form feedback, shared persisted auth state, working password-page routing, and callback/recovery-link handling.
- Profile editing checks failures; event views use the hosted `event_date` field, support search/retry, and refresh after navigation.
- Free registration handles existing rows and request failures correctly. Paid checkout is unavailable until payment verification is implemented. Membership is labeled as a preview.
- A saved registration remains successful when notifications fail. The backend verifies Supabase bearer tokens, derives the recipient from the caller, checks registration ownership, and validates Expo responses.
- A database migration adds profile synchronization, free-registration validation, capacity/inventory checks, and row ownership policies. It has been applied to the **separate hosted staging project only**; the original team's database is unchanged.

## Staging follow-up — September 21, 2026

Created a free development organization and separate `thabaat-staging` project. Applied the fresh schema, integrity migration, and new synthetic staging seed. Verified four RLS-enabled tables, seven policies, one future event, two ticket options, and zero anonymous event rows. Email signup and required email confirmation are enabled, and exact web/native callback and recovery URLs are configured. The local app uses an ignored `.env.local` staging override while preserving the original `.env`. No GitHub integration or deployment to main was enabled. Real signup/email, profile, registration, and iPhone acceptance remain separate checks; see the complete setup guide for current instructions.

## Verification

- 28 mobile tests, including 11 isolated PostgreSQL/PGlite tests; 13 backend tests.
- Mobile TypeScript/lint, backend TypeScript build, Expo dependency alignment, and all 21 Expo Doctor checks passed.
- iOS/Android/web JavaScript bundle exports passed.
- An isolated UI fixture passed login → event detail → paid-ticket rejection → free registration → confirmation → My Events → Already Registered, plus reload/session persistence and logout.
- Native iPhone Debug compilation succeeded with Xcode 27/iOS 27, then a signed development build installed and launched on a physical iPhone. Metro delivered the native bundle and the user confirmed the login/home screen. This does not certify every hosted account or data flow.
- Dependency audit at review time: mobile 14 moderate advisories, zero high/critical; backend zero advisories. Forced remediation proposed incompatible Expo dependency changes and was not applied.

## Configuration and follow-up

Each developer needs their own ignored `.env`; `.env.example` contains placeholders. Backend service-role credentials must stay server-side. No credentials, Apple signing material, generated native projects, installed dependencies, or build artifacts are included in this branch.

The tracked iOS bundle identifier is a development identifier; use the team's registered identifier for distribution. Local Personal Team testing required removing the generated iOS push entitlement. Native signing settings and that generated entitlement change remain machine-local; see the mobile README for reproducing the setup. No App Store, TestFlight, EAS cloud build, or production deployment was submitted.

Review the SQL migration in staging and inspect existing policies before applying it: permissive PostgreSQL policies combine with OR. Live capacity enforcement and push-token storage still require database setup. Hosted email auto-confirmation differs from the verification requirement; configure SMTP, confirmation behavior, and callback/reset allowlists with the team. Push delivery needs server credentials, a reachable backend, Expo project configuration, and paid developer provisioning. Live end-to-end registration needs appropriate future test events.

Payments, full membership management, donations, admin tools, QR check-in, media, and five-role authorization remain incomplete. Planning documents mark some membership work complete although this checkout contains only a preview; confirm whether implementation exists elsewhere. The documents also differ on payment-provider and public-browsing requirements.

## Requirement coverage


“Local fix” means implemented code plus the checks above; it is not stakeholder acceptance or live-device certification.

| Requirement IDs | Current coverage |
|---|---|
| REQ-01–04 | Auth/profile screens implemented and hardened locally. Hosted email verification, actual recovery email flow and physical-device sessions still need validation. |
| REQ-05 | Membership UI is a preview; it does not read real membership state. |
| REQ-06–09 | Purchases/subscriptions, renewals/cancellation, membership gates/discounts and complimentary memberships are not implemented. |
| REQ-10 | Upcoming-event feed and basic text search implemented. Additional filters are not present. |
| REQ-11 | Core detail screen exists. Rich logistics/FAQs/demographic restrictions are not implemented; optional speaker data is absent from the hosted schema. |
| REQ-12 | Free-ticket flow passes isolated UI/database tests. Paid checkout is unavailable; live capacity protection awaits migration review/application. |
| REQ-13–14 | Buying for others, donation prompts, refund/cancellation and transfer/gifting are not implemented. |
| REQ-15 | My Events works in the local flow. Waitlists, invitations and friend-attendance visibility are absent. |
| REQ-16 | Calendar export/integrations are absent. |
| REQ-17–21 | No implemented admin event/attendee management, QR check-in, live attendance or reporting/export module. |
| REQ-22–25 | Donation checkout, fundraising campaigns, receipts, history and campaign admin are absent. |
| REQ-26 | A device notification opt-in action exists. Category preferences and cadence controls are absent. |
| REQ-27 | Confirmation request code is hardened, but live delivery is blocked by missing service/device setup. Scheduled reminders, membership expiration and upload alerts are absent. |
| REQ-28 | Broadcast/segmented admin notifications are absent. |
| REQ-29–30 | Current app requires login. Public event browsing, universal app/web sharing links and sharing controls are absent. The SRS also contains conflicting login-only wording; resolve this with the team. |
| REQ-31–33 | Member media library, video playback/casting and video administration are absent. |
| REQ-34–38 | Five-role user administration, membership analytics, volunteer workflows, dashboards and CSV exports are absent. |
| REQ-39–40 | No staging performance/200-user load acceptance completed. |
| REQ-41–42 | Notification endpoint now authenticates callers; proposed DB policies and native session storage added. Hosted policy review and full role/payment security validation remain. |
| REQ-43–44 | Push delivery targets and QR latency are untested; receipts/QR implementation absent. |
| REQ-45 | Screens expose request failures and retry paths; no five-minute outage monitoring system. |
| REQ-46 | Donation receipt compliance is not implemented or assessed. |
| REQ-47 | Expo SDK 57 iOS/Android bundles build. A signed native iPhone build compiled, installed, and launched; the user confirmed the login/home screen. Broader device and release acceptance remain. |
| REQ-48 | Local core-flow smoke test passed; no stakeholder usability acceptance test. |
| REQ-49 | Feature branches exist and are merged; test commands are added. No CI configuration or evidence of independent staging deployment was found in this checkout. This review branch publishes the local changes for team review; it does not merge them into main. |
