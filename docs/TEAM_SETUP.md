# Thabaat team setup: Windows, iPhone and Mac

Updated October 7, 2026. These instructions describe the current handoff source on `codex/thabaat-team-handoff-20261007`. Before the branch is published, use the local Windows transfer ZIP; cloning the existing public `codex/expo57-mobile-fixes` checkpoint does not recover unpublished work. The repository is public, so keep all private configuration and evidence out of commits.

## 1. Downloads and platform limits

- [Git](https://git-scm.com/downloads/), [Node.js 24 LTS with npm](https://nodejs.org/en/download) and an editor such as [VS Code](https://code.visualstudio.com/download).
- Mobile requires Node >=22.13.0. The verified development environment used Node 24.21.0 and npm 11.19.0. Current packages: Expo ~57.0.24, React Native 0.86.3 and React 19.2.3. Use both checked-in package-lock.json files; do not force dependency upgrades to reproduce the app. [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/).
- Windows supports source editing, tests, web preview and the Node backend. Android development additionally needs [Android Studio](https://developer.android.com/studio). Python is not the backend runtime; install native build prerequisites only when an actual dependency requires them.
- Local iPhone compilation needs a Mac with full Xcode and CocoaPods. SDK 57 lists iOS 16.4+ and Xcode 26.4+ minimums; the verified setup used Xcode 27.0. Check [Apple's current Xcode compatibility](https://developer.apple.com/xcode/system-requirements) for your Mac/device.
- The installed standalone Release opens without Metro. Backend-backed features still need internet. A Debug/development client instead loads JavaScript from Metro. Windows can serve Metro to a previously installed compatible iPhone client; it cannot compile an iOS binary locally. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## 2. Get the code without overwriting another checkout

After publication:

```bash
git clone --branch codex/thabaat-team-handoff-20261007 https://github.com/LayaliShohatee/Thabaat.git Thabaat-handoff
cd Thabaat-handoff
git branch --show-current
git log -1 --oneline
```

Until publication, extract the supplied ZIP into a new folder and open its `Thabaat` directory. The ZIP has no Git history; Git synchronization commands apply to a clone, not that extracted snapshot. Commit or back up unfinished edits before switching or pulling branches. Compare commit IDs on both computers. Never use reset --hard, clean -fd or force push to discard a teammate's work.

There is no root npm application. Run mobile commands inside `thabaat-mobile`, backend commands inside `thabaat-backend`.

## 3. Mobile environment and installation

In `thabaat-mobile`, on Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
npm ci
```

On Mac Terminal:

```bash
cp .env.example .env.local
npm ci
```

Edit the private local file. Every angle-bracket value below is a placeholder; replace it without the brackets:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<APPROVED_PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<APPROVED_PUBLISHABLE_KEY>
EXPO_PUBLIC_BACKEND_URL=http://<COMPUTER_LAN_IP>:3000
EXPO_PUBLIC_ENABLE_PAYMENT_CHECK=false
EXPO_PUBLIC_SERVER_CHECKOUT=false
EXPO_PUBLIC_EVENT_WEB_ORIGIN=
```

Obtain the approved URL/key privately from the project owner. Keep URL and key from the same environment. Do not point new development migrations at the original shared database. Supabase public configuration is required before starting the real app; fake placeholders are not working credentials. Unit tests mock their dependencies.

EXPO_PUBLIC values are exposed in the client bundle. Never put SUPABASE_SERVICE_KEY, provider secrets or signing material there. [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys). Restart Metro after public env changes; rebuild a standalone Release to change its embedded configuration. Do not commit `.env`, `.env.local` or screenshots of their contents.

## 4. Checks, browser preview and Windows-to-phone development

Inside `thabaat-mobile`:

```bash
npm run typecheck
npm run lint
npm test
npm run web
```

Use the URL printed by Expo for the browser preview. Native QR camera, Calendar, video and signing need device verification; web success does not establish native acceptance.

With a compatible development client already installed on the phone:

```bash
npx expo start --dev-client --lan
```

Use the printed development link/QR in that client. Windows and the phone must share a reachable network. Permit the dev server on a trusted private network if Windows Firewall prompts; do not disable the firewall broadly. A phone's localhost refers to the phone, so the optional backend URL must use the computer's current LAN IP. Campus/guest networks may block peer access. Expo's optional `--tunnel` may require additional setup and does not expose a local backend automatically. [Expo CLI](https://docs.expo.dev/more/expo-cli/).

The standalone Release cannot be updated merely by starting Windows Metro. JavaScript edits can reload in a compatible development client; native modules, app config or SDK changes require another native build. Use the project client rather than assuming Expo Go contains every required native component. [Local native development](https://docs.expo.dev/guides/local-app-development/).

For optional Android development with the required SDK/device setup, run `npm run android` or `npx expo run:android --device`. Android device acceptance is separate from the iPhone checks.

## 5. Optional backend

In a separate terminal, from `thabaat-backend`, copy `.env.example` to `.env` (Windows: `Copy-Item .env.example .env`; Mac: `cp .env.example .env`). Obtain server-only credentials privately, or leave unavailable values empty for a health-only server. Mobile and backend must use the same approved database environment.

```bash
npm ci
npm test
npm run dev
```

The default port is 3000. Check `http://localhost:3000/health`; an OK response does not prove provider, notification or Wallet configuration. Basic event and ticket RPCs use Supabase directly. Payment flags stay disabled, Wallet fields remain empty, and FCM/scheduler adapters are not a deployed live delivery service.

For a compiled backend on Mac:

```bash
npm run build
npm start
```

The current build script uses Unix `mkdir -p` and `cp`. On Windows PowerShell, use this equivalent from the latest `thabaat-backend` directory:

```powershell
npx tsc
New-Item -ItemType Directory -Force dist\wallet\assets
Copy-Item src\wallet\assets\* dist\wallet\assets\
npm start
```

## 6. Mac iPhone build and signing

Install full Xcode and its required platform support, finish first-run setup, and install [CocoaPods](https://cocoapods.org/) if unavailable. Connect and unlock the phone; trust the computer and enable [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device) when required.

In a fresh/separate mobile build checkout with dependencies and env configured:

```bash
npx expo prebuild --platform ios
npx pod-install ios
open ios/Thabaat.xcworkspace
```

The current app is named Thabaat; inspect the generated workspace name if using an older checkpoint. Open the .xcworkspace so Pods are included. Preserve any working native directory and signing adjustments. Do not run `prebuild --clean` over it without backup; it can replace generated native changes.

In Xcode choose the physical phone, existing approved Apple account/team and automatic signing. The existing demo bundle is `com.hussaad.thabaat.dev`; use the owner-approved identity rather than inventing new signing credentials. Select Debug for a development client and Run, or `npm run ios -- --device`. For a standalone build, set the scheme's Run configuration to Release and build/install successfully before replacing a working app.

The free Personal Team demo target was built without the APNs entitlement. A fresh prebuild with expo-notifications may add a capability that the free profile cannot support. Review a demo-only native capability adjustment with the owner, or use an approved eligible team for push; do not enable unsupported services or alter live security settings to silence a build error.

The recorded October 5 Personal Team profile expires October 12 at 01:19:18 UTC (October 11, 9:19:18 PM Detroit). This is a dated profile observation, not a permanent guarantee. Recheck after signing refresh. [Apple Personal Team reprovisioning](https://developer.apple.com/help/account/basics/about-your-developer-account).

Renew with the approved existing Xcode account/team, rebuild and replace the same bundle rather than deleting the app. Replacement normally preserves the container; back up configuration and verify sign-in/bookings afterward. Cloud iOS builds are an optional separate approved workflow: `eas.json` has development profiles, but app.json has no linked EAS project and signing/account/device setup remains necessary. [EAS setup](https://docs.expo.dev/build/setup/).

## 7. Database and feature availability

Cloning, npm ci and a Git push do not apply SQL or deploy a backend. The separate development project has ten approved October 5 migrations; six additional migrations are local source only. See [current status](CURRENT_STATUS.md) for the exact list. Do not replay a schema, seed, migration or anonymous-grant proposal against an unverified project. Hosted schema/security changes require review and approval for the specific target.

Full tabs/Profile options are retained; a feature can still report missing setup. Live CharityStack payments, Wallet signing, production FCM/APNs and backend scheduling/hosting are incomplete. Missing notifications must not undo a saved registration.

## 8. Registration, check-in and roster

Home → Discover Events shows upcoming nonarchived events by date. My Events contains the caller's bookings. Events retains event management under database permissions.

An authorized camera scan validates automatically. For manual entry, use Validate and check in. Success shows Checked in; a repeat shows Already checked in without another attendance record. Select Scan next ticket to reset the scanner. Invalid, unauthorized and outside-window attempts must remain errors.

My Events shows Checked in with time separately from Confirmed booking status. It and the ticket refresh every five seconds while focused/active and on foreground return. Attendance comes from the server; unavailable reads remain unknown. Checked-in bookings cannot be freely cancelled. Open ticket or Refresh ticket reads the current saved state.

Event managers use Events → Check in the event → View attendee check-ins (event manager). The roster shows attendee names, recorded check-in time/Not checked in and booking status, without contacts or ticket credentials. It refreshes while open; attendance CSV export remains available. A nonmanager is denied by the existing report RPC.

The demo dates are now historical: Volunteer Check-in's window ended October 6 at 12:18 AM Detroit; Community Welcome Evening's window ends October 7 at 6 PM Detroit. The server accepts from four hours before event start through 24 hours after start. Check the actual event/time before a demonstration; do not bypass that window or fabricate attendance.

## 9. Troubleshooting and safe collaboration

- Old features: compare branch/commit IDs; reinstalling dependencies cannot recover unpublished code.
- Metro fails: check client/native compatibility, current IP, firewall and peer network access. Release does not need Metro.
- No data/login: check the approved project URL/key pairing and internet. Roles and visibility are enforced server-side; do not grant new roles merely to get a successful demo.
- Saved booking/no push: backend or provider configuration may be unavailable; registration remains saved.
- Attendance unchanged: return to My Events/ticket or refresh; verify the correct event/registration and the authorized scan result.
- Roster denied: use an authorized event manager; do not expose a public attendee endpoint.
- Signing fails or app stops opening: check profile expiration, Xcode/device compatibility and capability settings. Preserve the working binary/config; do not erase the app or revoke credentials by default.
- Work across computers: commit reviewed work, fetch before editing and use `git pull --ff-only` on a clean branch. Resolve divergence without force push. Keep package changes with their lockfiles; reinstall node_modules/Pods separately on each OS.
- Never commit keys, env files, generated builds, personal screenshots or private QR credentials. Avoid last-minute SDK upgrades, bulk migrations and repeated Calendar saves that create duplicates.

Verification dates and remaining device acceptance are recorded in [CURRENT_STATUS.md](CURRENT_STATUS.md). Earlier payment/platform documents remain historical reference, not instructions to enable live checkout or production services.
