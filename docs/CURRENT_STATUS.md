# Current Thabaat implementation status

Prepared October 7, 2026 for the team handoff on `codex/thabaat-team-handoff-20261007`. The previous public `codex/expo57-mobile-fixes` branch is an older checkpoint. This handoff contains source and instructions; publication does not merge, deploy, apply database changes or distribute a signed iPhone app.

## Current behavior

The complete member navigation remains available. Home browses upcoming nonarchived events; My Events shows caller-owned registrations. Free registration/cancellation/re-registration, private QR tickets, native Calendar actions and event management have server-checked flows. Successful scans persist attendance once; repeat scans preserve its time and return Already checked in. My Events and tickets display attendance separately from booking confirmation and refresh while focused/active/on return. An authorized event-manager roster shows names/times and booking status without contacts or credentials. Attendance export remains available.

Additional source includes event details/discovery/sharing/waitlists, volunteer/staff workflows, notification preferences/outbox/adapters, membership administration, media, gifts/friends/campaigns/account/analytics workflows. This list describes implemented source, not full hosted activation or device acceptance.

## Verification and native copy

The latest October 5 source check passed 324 tests in 55 files, TypeScript and lint. The native Release build and signature verification passed, and the connected iPhone installation succeeded. Login, free registration lifecycle, persistence, QR and native Calendar were previously user-checked. Backend checks/build had passed during implementation. Fresh October 7 handoff verification passed 25 focused attendance/scanner/refresh/UI/service tests in five files, mobile TypeScript and lint, and the backend build. The selected publication tree and all six unpublished inherited commits were checked for secrets/private data with no flags. Do not treat these checks or historical test counts as a fresh production audit.

On October 7, non-generated runtime files in the native demo copy match the source checkout. The source has newer ticket/UI tests and a pending media migration dependency fix; the older native-copy versions must not replace those source files. Generated native folders, private env and signing material are deliberately excluded from Git.

The newest My Events attendance label, event roster and camera repeat flow have code/server tests, but the worker's final physical-phone observation of those exact screens remains incomplete. Tests do not establish full production readiness or Android acceptance.

## Hosted schema: verified October 7

The separate development project has these ten approved migrations. The original shared database was not altered by this work:

- `20261005003918_registration_lifecycle.sql`
- `20261005003948_staff_volunteer_reporting.sql`
- `20261005004111_notification_preferences_outbox.sql`
- `20261005004630_media_library.sql`
- `20261005004731_ticket_checkin.sql`
- `20261005004906_rich_event_details.sql`
- `20261005004916_event_waitlist.sql`
- `20261005005512_notification_media_timezone.sql`
- `20261005005640_free_ticket_inventory.sql`
- `20261005005702_membership_administration.sql`

Six additional migrations are included as **unapplied source**, with their dependencies requiring review before any target-specific approval:

- `20261005011950_free_ticket_gifts.sql`
- `20261005012003_campaign_administration.sql`
- `20261005020903_private_friends_event_invites.sql`
- `20261005020944_media_playlists_uploads.sql`
- `20261005022500_admin_analytics.sql`
- `20261005023000_account_volunteer_workflows.sql`

Source lives under `thabaat-mobile/database/`. Reference schema, seed and proposal files are not a command to replay them against an existing project. No automatic migration or schema/security change is part of this handoff.

## Remaining services and acceptance

- CharityStack-only payment integration exists in disabled code paths, but live payment settlement, recurring membership and production provider verification remain unfinished. Keep both mobile payment flags and server enablement disabled for ordinary setup.
- Apple Wallet signing material/service activation is absent. QR is the usable ticket alternative; do not treat a Wallet UI as a signed pass.
- Production FCM/APNs configuration, delivery proof and notification scheduler/hosting integration remain incomplete. A push-service acceptance response is not device delivery.
- Media signing/upload and modules depending on the six local migrations require hosted setup and native acceptance.
- Public web fallback/hosting, full role/authorization review, account and volunteer onboarding details, load/security/UAT/monitoring and release checks remain pending.
- Free Personal Team profiles expire; the recorded current profile expires October 11 at 9:19 PM Detroit. Recheck any regenerated profile. A signed development installation is not App Store/TestFlight distribution.

## Publication boundaries

The local handoff selects app/backend source, tests, migrations/proposals, package/lockfiles, blank env templates and current run/status documentation. Private phone/demo evidence, real config, credentials, generated artifacts, dependencies and internal operational notes remain local. The root .gitignore reinforces these exclusions. Only publish this sanitized branch after its intended public audience is resolved. Keep main and existing PR work unmerged unless the team separately approves integration.
