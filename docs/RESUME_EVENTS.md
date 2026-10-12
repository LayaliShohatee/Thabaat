# Events and Permissions — paused checkpoint

Paused at the user's request on September 29, 2026. Resume only when requested. Keep all work on `codex/expo57-mobile-fixes`; do not merge or change `main`.

## Working checkpoint

Implementation commit: `b432621`. Events support browsing/search, free-event creation, basic editing, safe archiving and protected paginated attendee lists. Permissions supports server-enforced staff roles, account search, audited assignments and last-admin protection. The approved staging account has Admin access.

Staging is `qyxggeyqbebezlolvztf`. The original team database is unchanged. Events/permissions and attendee migrations are applied. Browser checks passed for creation, editing, archiving, account search and viewing an existing confirmed attendee. All 123 mobile tests, typecheck and lint passed before this preparation step. See `EVENTS_PERMISSIONS.md` for setup and limits.

Latest changes are committed locally, not pushed: command-line GitHub authentication is unavailable. Existing PR #1 remains unmerged. Do not report a successful push until verified.

## Remaining Gantt scope

Source reviewed: `Thabaat_Backlog_Gantt_(Updated).xlsx` in the supplied Capstone project archive. Its status labels are not implementation evidence.

| Gantt tasks | Remaining implementation |
| --- | --- |
| 65–70 | Advanced feed filters; complete speaker, address, demographics/eligibility, logistics and FAQ fields/display |
| 71–75 | Custom ticket inventory/types; general paid checkout; purchase for another user; optional donation prompt |
| 76–79 | Cancellation, re-registration, refund requests/deadlines, transfer/gift ownership and ticket history |
| 80–83 | Friend invitations, mutual/private attending visibility, gift acceptance within 24 hours, calendar export/integration |
| 84–87 | Extended event editor, flyer upload, ticket/settings controls and discount codes |
| 88–89 | Attendee filters, capacity/inventory consistency and waitlist admission |
| 90–94 | Per-ticket QR, scoped volunteer scanner, server validation, repeat-scan protection, check-in/no-show and attendance tracking |
| 95–96 | Registration/attendance CSV export and analytics |
| 43, 48, 133–134 | Extend role enforcement to new operations; event-scoped volunteer permissions; suspension and permission management |
| 58–59 | Real member-event gate and approved membership discounts; previously deferred, included in latest request to finish remaining event features |

The wider UC9 volunteer scheduling, membership administration, fundraising analytics and CRM roadmap is separate from this Events/Permissions request.

## Suggested implementation order

1. Database lifecycle and adversarial tests: cancellation/re-registration, bounded inventory, membership gates, waitlists and transfer acceptance. Preserve verified-payment enforcement and serialize allocations on the event row.
2. Member-facing event actions and organizer settings, then scoped QR check-in and attendance tools.
3. Images, exports/calendars, privacy-controlled social flows and reports.
4. Apply tested migrations only to staging, verify real browser workflows, update team instructions, and push after authentication is restored.

Do not infer paid prices, refund policies, discount rates or eligibility restrictions. Make them explicit per-event configuration; keep existing events unchanged. Refund requests must not claim money was returned. CharityStack API/webhook access and reliable payment correlation remain external blockers for automatic settlement/refunds; no real charge has been tested. Do not reply to the CharityStack email.

## Preparation completed before pause

- Reviewed the exact Gantt rows and existing registration/payment triggers.
- Supabase connector now works and lists the staging project; it can replace browser SQL entry. Only read-only queries were made during this preparation step.
- Checked Expo SDK 57 documentation and Supabase function/storage guidance.
- Supabase CLI is available through `npx supabase` (observed version 2.118.0). Create migration filenames with its `migration new` command; follow the Supabase skills when resuming.
- Exploratory native dependency/config changes and the empty lifecycle migration were removed before pausing. No new lifecycle feature or hosted schema change is being claimed as complete.
- QR camera/image picker additions will require a rebuilt iPhone development app; the existing free-signed app has expired. Browser testing remains available without a cable.

No further work, messages, or background follow-up is scheduled.
