# Handoff — October 12, 2026 (Windows)

Branch: `backlog-completion-2026-10-12` (built on `codex/thabaat-team-handoff-20261007`).
This branch closes the remaining app tasks in the Stakeholder Build Backlog. For general setup details see [TEAM_SETUP.md](TEAM_SETUP.md); this page is the short Windows path plus what changed.

## 1. Install once
- [Git for Windows](https://git-scm.com/download/win)
- [Node.js 24 LTS](https://nodejs.org) (includes npm). Check in PowerShell: `node -v` should print `v24.x`.
- Optional: [Android Studio](https://developer.android.com/studio) to run on an Android emulator or phone.

Windows can edit code, run all tests, preview the app in a browser, run on Android, and run the backend. Building the **iPhone** app needs a Mac (or an EAS cloud build); on Windows you can still load the app on an iPhone that already has the Thabaat development build installed (step 5).

## 2. Get the code (PowerShell)
```powershell
git clone https://github.com/LayaliShohatee/Thabaat.git
cd Thabaat
git checkout backlog-completion-2026-10-12
```
Already have the repo? Run `git fetch` then `git checkout backlog-completion-2026-10-12`.

## 3. Settings files (never commit these)
```powershell
cd thabaat-mobile
Copy-Item .env.example .env.local
```
Open `.env.local` and paste the Supabase URL and publishable key for the **thabaat-staging** project (Supabase dashboard → Project Settings → API, or ask Hussein privately). Keep these lines as they are:
```
EXPO_PUBLIC_ENABLE_PAYMENT_CHECK=false
EXPO_PUBLIC_SERVER_CHECKOUT=false
```

## 4. Install and check
```powershell
npm ci
npm run typecheck
npm run lint
npm test
```
Expected: typecheck and lint clean, **58 test files / 336 tests passing**.

## 5. Run the app
- **Browser preview (easiest on Windows):** `npm run web`, then open the printed `http://localhost:8081` link.
- **Android:** `npm run android` (emulator or USB phone with Android Studio set up).
- **iPhone with the Thabaat dev build already installed:** `npx expo start --dev-client --lan`, then open the printed link in the Thabaat development app. Phone and laptop must be on the same Wi-Fi; allow Node through Windows Firewall on a private network only.

> If login fails with "server not found": the free Supabase project pauses after about a week without use. Restore it at supabase.com/dashboard → thabaat-staging → **Restore project** (about 5 minutes).

## 6. Backend (optional)
```powershell
cd ..\thabaat-backend
Copy-Item .env.example .env
npm ci
npm test
npm run dev
```
Expected: **49 tests passing**. The `.env` needs the Supabase service key (server-only; get it privately, never paste it into the mobile app or GitHub). Notifications are only sent when `NOTIFICATIONS_ENABLED=true` is in `.env`. `npm run build` uses Mac/Linux commands; on Windows use the PowerShell steps in TEAM_SETUP.md.

## 7. What's new on this branch
| Area | Change | Where to see it |
|---|---|---|
| Events tab | Each event is a collapsible row | Events tab → tap an event |
| Tickets | Categories (Adult, Child, VIP, Food, Early bird) with sales end time | Events → event → Manage ticket types |
| Flyers | Upload a JPEG/PNG/WebP flyer (5 MB) | Events → Create/Edit event → Upload flyer image |
| Attendees | Gender/age filters (from optional profile fields) | Events → event → Show attendees; Profile → Edit Profile |
| Check-in | Mark individual no-shows after the event starts; CSV has a No-show column | Check in → View attendee check-ins |
| Registration | Discount codes + member discount price check; suggested donation after free registration | Register for a paid / free ticket |
| Refunds | Request refund before the event's deadline; managers approve/decline | My Events; Events → event → Manage refunds and discount codes |
| Transfer | "Transfer this ticket to someone else" (uses ticket gifting) | Open a ticket |
| Membership | Stop/keep renewing and switch plans in the app; admins manage tiers and confirm requests | Profile → Membership; Staff memberships |
| Public pages | Admin-published events viewable without signing in; web share links open them | Events → event → Manage public page; sign-in screen → Browse public events |
| Video | Background playback and picture-in-picture (needs a new native build) | Media library |
| Volunteers | Onboarding checklist after approval; shift reminders 24 h ahead | My volunteer shifts |
| Backend | Notification scheduler (`src/notifications/scheduler.ts`) | `NOTIFICATIONS_ENABLED=true` |
| Process | CI workflow, security audit, performance plan, user manual, admin guide | `.github/workflows/ci.yml`, `docs/` |

## 8. Database — already done, do not re-run
These migrations were **applied to the thabaat-staging Supabase project on October 12**:
`20261012120000_backlog_completion`, `20261012120100_event_flyer_storage`, `20261012120200_refunds_discounts`, `20261012120300_membership_public_volunteers` (all in `thabaat-mobile/database/migrations`).
Do not run them again or run other migrations in bulk; new database changes need team approval first.

## 9. Still open (not code)
Live CharityStack payments, Chromecast, stakeholder UAT, production launch, dependency security updates (see [SECURITY_AUDIT.md](SECURITY_AUDIT.md)) and load testing (see [PERFORMANCE_TEST.md](PERFORMANCE_TEST.md)).

## Troubleshooting
| Problem | Fix |
|---|---|
| `npm ci` fails | Make sure `node -v` is 24.x, delete `node_modules`, run `npm ci` again |
| New screens say "not installed on this database yet" | You are pointed at a different Supabase project; check `.env.local` |
| Phone can't reach the dev server | Same Wi-Fi, allow Node in Windows Firewall (private network), or try `npx expo start --dev-client --tunnel` |
| Typecheck errors about routes like `/public` | Run `npx expo start` once to regenerate route types, then stop it |
