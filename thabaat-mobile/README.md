# Thabaat mobile — Expo SDK 57

Start with the [complete team setup guide](../docs/TEAM_SETUP.md) for the full environment, Supabase, backend, iPhone signing, testing, and troubleshooting walkthrough.

For the latest payment feature, follow [Paid-only iPhone event test](../docs/PAID_EVENT_TEST.md). It documents the complete setup and manual verification required to unlock paid access.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and fill in the Supabase URL and publishable key.
   Set `EXPO_PUBLIC_BACKEND_URL` in this mobile folder to the backend computer's LAN address; `localhost` on a physical phone points to the phone itself.

3. Start the app

   ```bash
   npx expo start --clear
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Verification and device connection

Use Node.js 22.13 or newer and a native app compatible with SDK 57. Run from this directory:

```bash
npm run typecheck
npm run lint
npx expo-doctor
npx expo install --check
npx expo export --platform all
```

Keep the phone and computer on the same Wi-Fi network. If LAN discovery is blocked, try `npx expo start --tunnel`. Native development builds made with SDK 54 must be rebuilt. This project's push notification flow requires a development build on a physical device.

### iPhone and the SDK 54/57 mismatch

As of September 21, 2026, [Expo's compatibility documentation](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) says the iPhone App Store version of Expo Go stops at SDK 54. Installing the latest store app therefore does not make it compatible with this SDK 57 project. SDK 57 Expo Go is available through `eas go`/TestFlight with an Apple Developer membership, or use a development build of Thabaat.

Development-client dependencies and `eas.json` profiles are included locally. The local development bundle identifier is `com.hussaad.thabaat.dev`; replace it with the team's registered identifier for distribution. No Apple signing team or Expo project ownership is stored in the shared Expo configuration, and no cloud build has been submitted. Xcode 27 compatibility is enabled through `expo-build-properties` scene support. The generated, Git-ignored `ios` project has been checked for that scene configuration.

- **Build on this Mac:** install full Xcode and its iOS platform support, configure your Apple signing team and a unique `ios.bundleIdentifier` in `app.json`, pair the iPhone and enable Developer Mode, then run `npx expo run:ios --device`. With Xcode 27 and iOS 27 or later, Device Hub supports first-time wireless pairing: use **Add Device (+) → Pair Nearby Device** on the same Wi-Fi network. Older iOS versions need a cable for initial pairing. A local personal-device build can use a free Apple account, with Apple's provisioning limitations; push capabilities need the appropriate developer setup. See [Apple's device-pairing guide](https://developer.apple.com/documentation/xcode/pairing-your-devices-with-your-mac).
- **Build using EAS:** use the team's Expo account and Apple Developer membership. Link the correct Expo project, configure the same unique bundle identifier, register the iPhone, and set the mobile `EXPO_PUBLIC_` values in the EAS `development` environment (the ignored local `.env` is not cloud configuration). Then run `npx eas-cli@latest build --platform ios --profile development` and install the resulting internal build.

After installing the native app, run `npx expo start --dev-client --clear` and open **Thabaat's development app** on the iPhone. Each developer needs full Xcode and their own signing setup; JavaScript bundle exports alone do not install an iPhone app. A signed build from this branch was installed and its login/home screen confirmed on a physical iPhone. See [Expo's development-build setup](https://docs.expo.dev/develop/development-builds/introduction/).

The backend has its own `.env` with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and optionally `PORT`. Never put the service-role key in an `EXPO_PUBLIC_` variable.

## Current prototype and database

The app uses the hosted `events.event_date` column. The older `date` column in the original schema file did not match the hosted database. `database/schema.sql` is a fresh-project reference, not a script to rerun against existing tables.

Review `database/migrations/20260921_prototype_integrity.sql` in staging first. It adds missing notification, capacity, inventory, and registration-status fields, synchronizes auth profiles, validates free registrations, and defines row ownership policies. Existing policies must be inspected because permissive policies combine with OR. This migration has been applied to the separate `thabaat-staging` project; the team's original hosted database is unchanged. `database/staging-seed.sql` provides a synthetic future event with free/paid ticket options for staging-only acceptance tests. See the complete guide for the ignored `.env.local` staging override.

The current app supports account screens, profiles, event browsing/search, and free-ticket registration. Paid tickets are deliberately unavailable until payment verification exists. The membership page is a preview. There is no implemented admin portal, donation checkout, QR check-in, video library, or five-role authorization system in this checkout.

In Supabase Auth, allow the callback and reset URLs generated for each environment. Web development uses `http://localhost:8081/auth/callback` and `http://localhost:8081/auth/reset-password`. A native development build uses `thabaat://auth/callback` and `thabaat://auth/reset-password`; Expo Go uses its development-server URL. Links now restore the session before navigating. The hosted project's inspected settings auto-confirm email accounts, which differs from the SRS email-verification requirement; the team must choose and configure the intended behavior.

## Regression tests

```bash
npm test
npm run typecheck
npm run lint
```

The test suite uses mocks and an isolated PGlite PostgreSQL instance. It does not mutate the team's database. It checks auth routing, link parsing, query contracts, notification failures, profile isolation, ticket ownership, duplicates, capacity, past events, and paid-checkout rejection.

To reproduce the isolated UI smoke test, run these in two terminals from this folder:

```bash
node tests/fixtures/supabase-server.mjs
```

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-e2e-key EXPO_PUBLIC_BACKEND_URL= npx expo start --web --port 8082
```

Open `http://localhost:8082` and use `demo@example.invalid` / `local-demo-password`. These are local fixture values, not real credentials. Verify login → event → ticket selection → confirmation → My Events → Already Registered. Stop both fixture processes after testing. The real app runs separately on port 8081 using the ignored `.env`.

### Current local Personal Team build

The generated, ignored iOS project is configured for local Personal Team testing. Its `aps-environment` entitlement was removed to permit free-account signing. Regenerating `ios` restores Expo notification entitlements, so either use the team’s paid provisioning for push or remove that entitlement again for a Personal Team build. Local device provisioning expires September 28, 2026 and must be renewed with a new signed build. Device installation does not establish that real push, payments, or all hosted data flows work.

See [the team review](../docs/mobile-sdk57-review.md) for the scope, verification results, and outstanding work.
