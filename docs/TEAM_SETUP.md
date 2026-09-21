# Thabaat: complete team setup and handoff

Updated September 21, 2026. This guide collects the work from the original Expo connection/account-creation investigation through the successful signed iPhone installation. Follow it to reproduce the development environment on your own computer. It also identifies configuration that is still pending so a working login screen is not mistaken for a fully deployed product.

## 1. Choose the updated code and keep the original separate

- **Original:** [main](https://github.com/LayaliShohatee/Thabaat/tree/main), reviewed at `abba4c61610096c6eb518819d553641cd3d3c29c`.
- **Updated:** [codex/expo57-mobile-fixes](https://github.com/LayaliShohatee/Thabaat/tree/codex/expo57-mobile-fixes).
- **Every code change:** [branch comparison](https://github.com/LayaliShohatee/Thabaat/compare/main...codex/expo57-mobile-fixes).
- **Detailed requirements review:** [mobile-sdk57-review.md](mobile-sdk57-review.md).

The updated branch contains the complete repository, including unchanged files. Keep the pull request unmerged to preserve the two separate versions. Reading either branch or downloading it does not merge anything. The four pre-existing feature branches were already included in the reviewed main baseline.

For a new checkout, run:

```bash
git clone --branch codex/expo57-mobile-fixes https://github.com/LayaliShohatee/Thabaat.git Thabaat-updated
cd Thabaat-updated
git branch --show-current
```

The final command should print `codex/expo57-mobile-fixes`. These instructions use this folder as the **repository root**. If you already have a checkout with unfinished work, use this separate folder instead of overwriting it. Private repository access, if required, uses each teammate's own GitHub account.

For a separate local copy of the original, run the following from the parent folder, outside `Thabaat-updated`:

```bash
git clone --branch main https://github.com/LayaliShohatee/Thabaat.git Thabaat-original
```

## 2. Install the development tools

| Tool | Needed for |
|---|---|
| Git | Cloning and reviewing the branches |
| Node.js **22.13 or newer**, with npm | Mobile and backend commands; Node 22 is a suitable baseline |
| Full Xcode with iOS platform support, on macOS | Building and signing a native iPhone app; Command Line Tools alone are insufficient |
| CocoaPods | Installing iOS native dependencies; the tested Mac used 1.17 |
| Apple Account and a paired iPhone | Personal-device installation; the tested setup used Xcode 27 and iOS 27 |
| Access to the team's Supabase configuration | Real authentication and event data |

Web development and automated tests do not require Xcode. Local iPhone compilation requires a Mac. A cloud iPhone build is a separate option described below.

Check your installation:

```bash
git --version
node --version
npm --version
```

For an iPhone build, open Xcode once, complete its license/first-run setup, and install iOS platform support. Then check:

```bash
xcodebuild -version
pod --version
```

If CocoaPods is missing and you use Homebrew, install it with `brew install cocoapods`. If Xcode commands resolve to standalone Command Line Tools, select the full Xcode installation in Xcode's Locations settings.

The checked-in mobile dependencies use Expo `~57.0.24`, React Native `0.86.3`, React `19.2.3`, and an Expo development client. **Use the lockfiles with `npm ci`**; do not independently upgrade React Native or force dependency-audit fixes to reproduce this setup.

## 3. Install both projects

From the repository root:

```bash
cd thabaat-mobile
npm ci
cd ../thabaat-backend
npm ci
cd ..
```

There is no root npm application. Run mobile commands inside `thabaat-mobile` and backend commands inside `thabaat-backend`.

## 4. Create your local environment files

These files are intentionally ignored by Git. Each teammate creates their own; cloning the branch cannot copy the original developer's local credentials.

### Mobile: `thabaat-mobile/.env`

From `thabaat-mobile`, on a fresh checkout:

```bash
cp .env.example .env
```

Edit the file to contain your team's values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_BACKEND_URL=
```

Obtain the URL and publishable key for the **same Supabase project** from the project owner or project settings. Enter plain values, without Markdown links, backslashes before underscores, or screenshot line breaks. The original investigation initially had no Supabase environment file; those values were subsequently configured locally.

Leave `EXPO_PUBLIC_BACKEND_URL` empty until you have a configured, reachable notification backend. Authentication and event queries use Supabase directly. When the backend is ready, set this to its address, for example `http://192.168.1.100:3000`, replacing the example IP with the computer actually running it. On a physical phone, `localhost` means the phone, not your Mac.

All `EXPO_PUBLIC_` values are exposed to the client app. **Never put a service-role key, Apple credential, or backend secret here.** Stop and restart Expo with `--clear` after changing these values; exported or installed bundles may also need to be rebuilt to pick up configuration.

### Backend: `thabaat-backend/.env`

For notifications, copy its own `.env.example` to `.env` and fill in:

```dotenv
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
EXPO_ACCESS_TOKEN=
```

The project must match the mobile app. The service-role key is server-only and is different from the publishable key. Set `EXPO_ACCESS_TOKEN` only if the Expo project uses push access-token security. Obtain these through the team owner; they were not supplied during the original setup.

To start the backend without notification credentials, leave the Supabase values empty instead of leaving fake placeholder keys. It can serve its health endpoint, but authenticated notification requests will be unavailable. Do not overwrite an existing populated `.env` with the example.

## 5. Prepare Supabase and account redirects

**The proposed database migration has not been applied to the team's hosted project.** Cloning the code or starting Expo does not apply SQL. A project owner should review and test it in staging before changing a shared database.

1. For a **new, empty staging Supabase project**, review and run [database/schema.sql](../thabaat-mobile/database/schema.sql), then [database/migrations/20260921_prototype_integrity.sql](../thabaat-mobile/database/migrations/20260921_prototype_integrity.sql) through that project's SQL editor.
2. For an **existing project**, do not rerun the `CREATE TABLE` reference schema. Review existing columns, duplicate registrations, constraints, and policies before applying the migration. The migration targets the hosted `events.event_date` column.
3. Inspect existing row-level security (RLS) policies. Permissive PostgreSQL policies combine with OR; adding stricter policies does not cancel an older permissive policy.
4. Check profile creation for new accounts and synchronization for existing accounts. Registrations reference profiles, so a missing profile can prevent registration.
5. Create suitable staging test data through the database owner: a future event with available capacity and a free ticket (`price = 0`, positive quantity) referencing that event. No seed script or admin event editor is included.

The migration adds missing capacity, ticket quantity, registration status, and push-token fields; synchronizes auth profiles; and validates new free registrations for ownership, event date, duplicate registration, ticket/event matching, and availability. It was tested in isolated PostgreSQL. It does not implement payment processing or a complete admin/role system.

In Supabase Auth, enable the intended email sign-in/signup behavior and allow the callback URLs for each environment:

| Environment | Callback | Password reset |
|---|---|---|
| Local web on port 8081 | `http://localhost:8081/auth/callback` | `http://localhost:8081/auth/reset-password` |
| Native development app | `thabaat://auth/callback` | `thabaat://auth/reset-password` |

Adjust web URLs when using a different port or deployed host. The app generates links for its current environment. The inspected hosted settings auto-confirmed email accounts; the requirements call for email verification. The team must choose the intended setting and configure email delivery/SMTP and redirect allowlists accordingly. Actual signup, confirmation-email, and recovery-email delivery still need staging acceptance tests.

## 6. Start the backend and web app

In a terminal inside `thabaat-backend`:

```bash
npm run dev
```

In another terminal:

```bash
curl http://localhost:3000/health
```

The response should report `status: "ok"`. `notificationsConfigured: false` means notification credentials are missing. A true value indicates configuration is present, not that credentials or device delivery have been verified.

In a separate terminal inside `thabaat-mobile`:

```bash
npx expo start --web --port 8081 --clear
```

Open `http://localhost:8081`. Check that login and create-account forms show feedback and that errors are visible. Use an authorized staging account for real-data tests. An empty event feed can mean no future events are visible to that account, incorrect project settings, or RLS restrictions; it does not by itself establish an app failure.

Keep the server terminals running. Stop them with Ctrl+C when finished. To run the compiled backend instead, stop its development server first, then run `npm run build` followed by `npm start` inside `thabaat-backend`.

## 7. Reproduce the iPhone installation

### Why the development app is needed

As of this review, Expo's [SDK mismatch documentation](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) states that the iPhone App Store version of Expo Go stops at SDK 54. This repository uses SDK 57. Installing the latest store app therefore does not fix this specific mismatch. The successful route was building and installing **Thabaat's own development app**. iPhone Mirroring displays/controls the phone; it does not replace native compilation, pairing, or signing.

### Pair and prepare the device

1. Connect and unlock the iPhone with a cable, and accept the device trust prompts. The completed installation used a cable.
2. Enable **Settings → Privacy & Security → Developer Mode** on the iPhone and complete the restart/confirmation prompts.
3. Sign in with your own Apple Account in **Xcode → Settings → Apple Accounts**.
4. Confirm Xcode can see the phone. With Xcode 27 and iOS 27 or later, first-time wireless pairing is also available through **Device Hub → Add Device (+) → Pair Nearby Device** on the same network. See [Apple's pairing instructions](https://developer.apple.com/documentation/xcode/pairing-your-devices-with-your-mac).

### Generate the native project

The checked-in `app.json` enables Xcode 27 scene support through `expo-build-properties`. Its iOS bundle identifier is a development identifier. If it is unavailable to your signing team, set `expo.ios.bundleIdentifier` to your own unique development identifier before generating the app. Use the team's registered identifier for distribution.

From `thabaat-mobile`:

```bash
npx expo prebuild --platform ios
```

This generates the ignored `ios` project and installs native dependencies. If dependency installation did not complete, resolve that error before building; with CocoaPods available, `pod install` can be run inside the generated `ios` directory. Do not put independent application logic only inside this generated folder: regeneration can overwrite native changes.

### Free Apple Personal Team: the tested route

Free Personal Team provisioning cannot include this app's remote-push entitlement. After prebuild, remove it **only from the generated local file**, if the key is present:

```bash
plutil -remove aps-environment ios/thabaatmobile/thabaatmobile.entitlements
```

An absent-key error means there is nothing to remove. Regenerating iOS restores Expo's notification entitlement, so repeat this local step when necessary for free signing. Keep the source notification plugin for builds that use supported paid-team provisioning. This Personal Team build is not a remote-push delivery test.

Open the CocoaPods workspace, not the `.xcodeproj`:

```bash
open ios/thabaatmobile.xcworkspace
```

In Xcode, select the **thabaatmobile target → Signing & Capabilities**. Enable automatic signing, choose your Personal Team, and choose your iPhone as the run destination. Review any prompts allowing Xcode to create an Apple Development certificate, register the phone, and create its provisioning profile. Each teammate performs this with their own authorized account; certificates and profiles are not shared in this repository.

### Start Metro, build, trust, and open

Stop an existing Expo server on port 8081 before starting this one. From `thabaat-mobile`:

```bash
npx expo start --dev-client --clear
```

Leave it running. In Xcode choose **Product → Run** to build and install. If iOS blocks the first launch, open **Settings → General → VPN & Device Management**, select your developer profile, and trust/verify it if you accept it. Complete any requested restart.

Open the installed **thabaat-mobile** app and select the Mac's development server or use the development-client QR link shown by Expo. Keep the Mac awake and Metro running. Put both devices on a network where they can reach each other, and allow the app's local-network permission for discovery. USB installation alone does not guarantee network access to Metro.

You should reach the login or home screen. That screen was confirmed on the original physical iPhone after signed installation, developer trust, and native bundle delivery.

Personal Team provisioning is temporary. Check your profile's expiration and rebuild/re-sign as needed. The original tested profile has an expiration date of September 28, 2026; a teammate's profile has its own expiration. Changes to native dependencies, bundle identifier, or native plugins also require a new native build. Ordinary JavaScript edits generally reload through Metro.

### Optional paid-team / cloud route

A paid team's supported provisioning can retain the push entitlement. A cloud build additionally needs the team's Expo account/project, appropriate Apple Developer membership, a registered device and bundle identifier, and the mobile environment values configured in EAS's `development` environment. Your ignored local `.env` is not a substitute for cloud configuration.

After the team configures those prerequisites, the included `development` profile in `eas.json` supports:

```bash
npx eas-cli@latest build --platform ios --profile development
```

No EAS cloud build, TestFlight submission, App Store release, or paid-team push test was performed during this work. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) and [SDK 57 / Xcode 27 compatibility](https://expo.dev/changelog/sdk-57).

## 8. Configure notifications only when ready

Real remote push requires all of the following: a physical-device build with appropriate push provisioning, the team's Expo project ID, APNs credentials for iOS (FCM for Android), `profiles.expo_push_token` and the appropriate policies, backend service credentials, and a backend URL reachable from the phone. The project ID and paid-team credentials still need team configuration.

Use **Profile → Enable Notifications** after setup to request permission and save the token. The app sends its Supabase session bearer token and event ID to the backend; the backend checks the caller's registration and derives the recipient. A saved registration remains successful if the notification request fails. A response marked `accepted` means Expo accepted a push ticket, not confirmed delivery. Receipt processing, scheduled reminders, notification preferences, and admin broadcasts are not implemented.

## 9. Run checks and the isolated demonstration

From `thabaat-mobile`:

```bash
npm test
npm run typecheck
npm run lint
npx expo-doctor
npx expo install --check
npx expo export --platform all
```

From `thabaat-backend`:

```bash
npm test
npm run build
```

The reviewed code passed **28 mobile tests and 13 backend tests**, mobile TypeScript/lint, the backend build, Expo dependency checks, all 21 Expo Doctor checks, and iOS/Android/web JavaScript exports. Tests use mocks and isolated PGlite PostgreSQL rather than modifying hosted data. JavaScript exports do not substitute for native installation or Android device testing.

For a browser demonstration without Supabase credentials, use these two terminals **inside `thabaat-mobile`**. The second command uses macOS/Linux shell syntax.

Terminal A:

```bash
node tests/fixtures/supabase-server.mjs
```

Terminal B:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-e2e-key EXPO_PUBLIC_BACKEND_URL= npx expo start --web --port 8082
```

Open `http://localhost:8082`. Use `demo@example.invalid` with `local-demo-password`; these are synthetic fixture values. Check login → event details → paid-ticket rejection → free registration → confirmation → My Events → Already Registered. Reload to check session persistence, then log out and check empty-form validation. This flow passed during the review.

Stop both fixture processes afterward. Do not save fixture values into the real `.env`. This fixture is for a local browser; its loopback address cannot be used from the iPhone. Real signup/email delivery, live database policies, and actual push delivery require separate staging tests.

## 10. What changed from the original code

| Area | Work included in this branch |
|---|---|
| Expo and native setup | SDK 54 → 57, aligned React/React Native dependencies and lockfile, development client, EAS profiles, Node requirement, Xcode 27 scene support |
| Authentication | Shared persisted auth state, native session storage/refresh, routing race protection, callback and password-recovery handling, accessible change-password routes |
| Account forms | Visible web/native feedback, trimmed email input, error handling, and loading-state recovery so create-account actions no longer fail silently |
| Profiles | Name/email display, checked profile updates, metadata synchronization handling, account links, notification action, and logout feedback |
| Events | Hosted `event_date` field alignment, optional-column handling, title/location search, focus refresh, loading/error/retry behavior |
| Registration | Existing-registration error handling, duplicate-submit protection, corrected confirmation title, free-ticket flow, paid checkout disabled pending trusted payment verification |
| Notification client | Device/runtime checks, permission/token handling, authenticated requests, timeout handling, and nonfatal notification failure after a saved registration |
| Backend | Verified Supabase sessions, recipient/registration ownership, input and Expo-response validation, rate limiting, limited request size, configuration checks, and tests |
| Database proposal | Schema reference correction, migration for profiles/ownership/capacity/inventory/free registrations, and isolated database tests; no hosted migration applied |
| Team handoff | Environment examples, setup instructions, regression fixtures, and requirements coverage review |

The full comparison linked at the top lists each added, edited, or removed source file. The supplied project-layout ZIP was reviewed against the checkout; its original planning attachments are not republished in this code repository.

## 11. Troubleshooting

| Symptom | Check or next step |
|---|---|
| Expo says SDK 54 instead of 57 | Confirm the checked-out branch, run `npm ci` in mobile, and open a rebuilt SDK 57 development app rather than the incompatible App Store Expo Go |
| Create account fails | Check the mobile `.env` names/values and project match, restart Expo, read the displayed error, and inspect Supabase signup/email settings and profile schema in staging |
| Confirmation/reset link fails | Allow the exact redirect for this environment, verify the app scheme, and request a fresh link; a successful login screen does not test mail delivery |
| Signing rejects push capability | For a free Personal Team, remove the generated `aps-environment` key after prebuild; for a paid team, check its provisioning/capabilities |
| Phone reports untrusted developer | Trust the profile under VPN & Device Management and complete any requested confirmation/restart |
| Installed app stops opening later | Check provisioning expiration and rebuild/re-sign; also ensure the development server is running |
| Phone cannot reach Expo/backend | Check the Mac's current LAN IP, local-network permission, network isolation/firewall, and running servers. A phone cannot use the Mac's `localhost` |
| Campus Wi-Fi blocks Metro discovery | Try a network/hotspot allowing device-to-device access or `npx expo start --dev-client --tunnel`. An Expo tunnel does not automatically expose your notification backend or fix an SDK mismatch |
| No events or registration fails | Check future event dates, ticket/event IDs, available quantity, signed-in profile, and reviewed migration/RLS setup |
| Registration saved but no push | Check notification prerequisites above; lack of push does not undo the saved registration |
| Port already in use | Stop the earlier process with Ctrl+C or choose another port and update relevant backend/redirect URLs |

## 12. Verified outcome and remaining work

The original Mac completed unsigned and signed native iPhone Debug builds, signature checks, device installation, developer-profile trust, app launch, and Metro bundle delivery. The user confirmed the login/home screen. The automated and isolated browser checks above also passed. Dependency review found 14 moderate mobile advisories and zero high/critical ones; the backend audit found none at that time. Forced remediation proposed incompatible Expo changes and was not applied.

Still pending: owner review/application of the hosted migration, intended email verification and recovery delivery, full live account/registration acceptance, paid-team notification configuration and delivery, and broader device/release testing. Membership is a preview. Payments, donations, a full admin portal, five-role authorization, QR check-in, and the media library are not implemented here. See the requirements review for coverage by requirement ID.

Dependencies, generated iOS files, compiled apps, `.env` files, Apple certificates/profiles, and personal device identifiers stay on each developer's machine. The branch supplies source, lockfiles, configuration examples, tests, and these reproduction steps.

For everyday work, start the configured backend when needed, start Metro with `npx expo start --dev-client` inside mobile, and open your installed development app. Run the relevant checks before publishing changes. Keep working on a separate branch and leave the original main branch unmerged until the team explicitly decides otherwise.
