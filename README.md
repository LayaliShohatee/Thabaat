# Thabaat

Latest team handoff prepared October 7, 2026 on `codex/thabaat-team-handoff-20261007`. This repository includes the Expo mobile app, Express backend, lockfiles, tests and database source. Publishing a branch does not merge it into `main` or deploy its services.

Start with [the current team setup guide](docs/TEAM_SETUP.md) for Windows, iPhone and Mac instructions. [Current implementation status](docs/CURRENT_STATUS.md) distinguishes implemented code, deployed development schema, historical device checks and remaining work.

## Get the handoff

The following command works once this handoff branch is published. Until then, the public `codex/expo57-mobile-fixes` branch remains an older checkpoint; use the provided local transfer package for unpublished work.

```bash
git clone --branch codex/thabaat-team-handoff-20261007 https://github.com/LayaliShohatee/Thabaat.git Thabaat-handoff
cd Thabaat-handoff
```

## Install and run

Use Node.js 24 LTS with npm; the mobile package requires Node >=22.13.0. The current source uses Expo SDK 57, React Native 0.86.3 and React 19.2.3. Install each project's own lockfile dependencies with `npm ci`.

From `thabaat-mobile`, copy `.env.example` to `.env.local`, then fill the approved project URL and publishable key privately. On Windows use `Copy-Item .env.example .env.local`; on Mac use `cp .env.example .env.local`.

```bash
cd thabaat-mobile
npm ci
npm run typecheck
npm run lint
npm test
npm run web
```

For a compatible installed development client, use `npx expo start --dev-client --lan`. The standalone iPhone Release app contains its own JavaScript and does not require Metro, but backend data still requires internet. Windows can serve JavaScript to an existing compatible iPhone development client; native iOS compilation requires Mac/Xcode or a separately authorized cloud build. Expo Go is not a substitute for verifying this project's native modules.

The optional backend runs from `thabaat-backend`: configure its private `.env`, then `npm ci`, `npm test` and `npm run dev`. See the setup guide for its Windows compiled-build equivalent; `npm run build` currently uses Unix copy commands.

## Current member and staff flow

The app's look follows the client's 2026 brand refresh; tokens, logo files and the rules are documented in [docs/BRAND.md](docs/BRAND.md).

- Home discovers upcoming events; My Events shows the caller's bookings.
- Successful check-in is saved on the server. My Events and tickets display attendance separately from booking status and refresh while active.
- Events → Check in an event → View attendee check-ins (event manager) shows an authorized roster with names and check-in times.
- Repeat scans return Already checked in and preserve the original time. Invalid, unauthorized and outside-window scans remain rejected.
- Full Events, Permissions and Profile navigation is retained. Optional features may report missing setup where their migrations or services remain undeployed.

The hosted development schema and live services are not automatically installed by cloning this repository. Six additional local migrations remain unapplied. Payments, Wallet signing, production FCM/APNs delivery, scheduler/hosting integration and complete production acceptance remain unfinished; see [status](docs/CURRENT_STATUS.md).

Environment values, generated native projects, installed dependencies, compiled apps, signing material, private QR files and personal screenshots stay local. Do not run bulk migrations, publish private data, force-push teammate work or treat passing tests as production readiness.
