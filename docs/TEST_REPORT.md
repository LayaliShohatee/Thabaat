# Test plan execution report (backlog #146)

Run on October 12, 2026 against branch `backlog-completion-2026-10-12` and the **thabaat-staging** Supabase project.

## Summary
| Suite | Result |
|---|---|
| Mobile app automated tests (vitest, 59 files) | **340 / 340 passed** |
| Backend automated tests (node:test) | **50 / 50 passed** |
| TypeScript typecheck (app + backend) | Clean |
| Lint (`expo lint`) | Clean |
| GitHub Actions CI on the pull request | Passing (mobile + backend jobs) |
| Load test (k6, 25 users) | Pass — 0% errors, 71 ms p95 ([PERFORMANCE_TEST.md](PERFORMANCE_TEST.md)) |
| Security review | [SECURITY_AUDIT.md](SECURITY_AUDIT.md); 0 critical dependency findings |

Database tests run every migration against a real Postgres engine (PGlite) and sign in as each role — **member, volunteer, organizer, administrator** and signed-out visitor — to check that each action is allowed or refused correctly.

## Coverage by use case module
| Module | What was tested | Evidence |
|---|---|---|
| UC1 Accounts | Sign-in routing, auth links, password reset/change, profile demographics, role access, account suspension | `auth-routing`, `auth-links`, `backlog-database`, `account-volunteer-database`, `events-permissions` |
| UC2 Membership | Plans and status, test purchase, renewal/cancel/plan change requests, expiry reminders, member-only content and events, member ticket discount, complimentary issuance | `billing*`, `membership-*`, `backlog-membership-public-database`, `payment-sandbox-database`, `media-security` |
| UC3 Events & registration | Feed/search/filters, details, ticket categories and early-bird cutoff, free and paid (test) registration, discount codes, cancel, refund requests, gifting/transfer, friends, calendar | `event-*`, `registration-lifecycle`, `backlog-database`, `payment-sandbox-database`, `ticket-gifts-database`, `friends-*` |
| UC4 Event admin | Create/edit/archive, flyer validation, ticket inventory, attendee list with demographic filters, waitlist, QR tickets and scanner, check-in, no-shows, CSV export | `free-ticket-inventory`, `backlog-helpers`, `event-waitlist`, `ticket-database`, `ticket-scanner`, `csv-export`, `staff-reporting` |
| UC5 Donations | Campaigns, progress totals, one-time and monthly (test) gifts, cancel monthly, history, admin campaign tools, donor export | `campaign-*`, `payment-sandbox-database`, `billing-database` |
| UC6 Notifications | Preferences, confirmations, 1-week/24-hour/morning reminders, expiry and new-video alerts, broadcasts, volunteer shift reminders, scheduler | `notification*`, backend `notification-worker`, `notification-scheduler`, `notify`, `fcm` |
| UC7 Community | Public event pages for signed-out visitors, share and deep links | `backlog-membership-public-database`, `event-sharing`, `event-share-service` |
| UC8 Video | Library, playlists, uploads, secure signed playback (60 s; 2 h for Chromecast), resume | `media*`, backend `media` |
| UC9 Admin & volunteers | Roles, suspension, tiers, analytics, volunteer applications/shifts/attendance/onboarding, exports | `admin-analytics`, `staff-database`, `account-volunteer-database`, `backlog-membership-public-database` |

## Manual checks on the iPhone simulator (standalone Release build, staging data)
| Flow | Result |
|---|---|
| Launch, stay signed in, event feed loads from staging | Pass |
| Redesigned Home, filters, event cards, tab bar | Pass |
| Create free event (Events tab) | Pass |
| Join membership with test payment → active Monthly Member through 11/12/2026 | Pass (confirmed in database) |
| Give $25 test donation → campaign total $0 → $25 | Pass |
| Paid ticket screen shows member/code pricing and "Pay (test payment)" | Pass (purchase logic covered by database tests) |

## Not covered here
Stakeholder acceptance testing with all five roles on real devices (#151), Android device testing, and testing on a production database — these need the client.
