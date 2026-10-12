# Security audit (backlog #147)

Prepared October 12, 2026 from a code and dependency review. This is the team's internal audit; an independent penetration test is still recommended before production launch.

## Scope
Authentication, payments, gated (members-only) content and member data protection, across the Expo app, the Express backend and the Supabase database migrations.

## Authentication and accounts
| Check | Result |
|---|---|
| Sign-in, sign-up and password reset use Supabase Auth; no passwords are stored by Thabaat | Pass |
| Signed-out users are redirected to login except auth pages and admin-reviewed `/public` pages (`lib/auth-routing.ts`) | Pass |
| Suspended accounts are blocked in new write functions (`assert_active_account()` guard) | Pass |
| Backend routes verify the caller's Supabase token (`thabaat-backend/src/middleware/auth.ts`) | Pass |

## Database access (row-level security)
| Check | Result |
|---|---|
| Every new table enables row-level security and revokes direct access (`event_no_shows`, `refund_requests`, `promo_codes`, `membership_change_requests`, `volunteer_onboarding`, public preview tables) | Pass — covered by `tests/backlog-*-database.test.ts` |
| All writes go through `SECURITY DEFINER` functions with `search_path=''` and explicit role checks | Pass |
| Staff-only functions check `current_staff_role()` / `can_manage_staff_event()` | Pass — tested for members, volunteers, organizers and admins |
| Anonymous (signed-out) access is limited to `reviewed_public_event(s)`, which return only admin-approved fields of non-member, non-archived events | Pass — needs stakeholder approval before the migration is applied |
| Attendee demographics (gender, age) are optional, self-reported and visible only to the event's organizer/admin | Pass |

## Payments
| Check | Result |
|---|---|
| Card details never touch Thabaat; checkout opens CharityStack's hosted page | Pass |
| CharityStack webhooks are verified before the JSON parser and stored in an inbox table | Pass |
| Discount codes and member discounts are calculated on the server (`quote_ticket_price`); limits are enforced with a row lock (`redeem_promo_code`) | Pass |
| Refunds are requests reviewed by event managers; money is returned in CharityStack | Pass |
| Live payment processing is disabled until the CharityStack integration is approved | Open — external |

## Gated content and storage
| Check | Result |
|---|---|
| Member videos live in a private bucket and are served through 60-second signed URLs | Pass |
| Event flyers use a separate public bucket limited to JPEG/PNG/WebP up to 5 MB, uploaded only by admins/organizers into their own folder; file signatures are checked in the app | Pass |

## Dependency scan (`npm audit --omit=dev`, October 12)
| Package | Findings | Notes |
|---|---|---|
| thabaat-mobile | 34 (1 critical, 21 high, 12 moderate) | Almost all in Expo CLI/build tooling, not in the shipped app. Fix with an Expo SDK patch update after the presentation and retest. |
| thabaat-backend | 5 (1 critical, 4 high) | `proxy-addr` (Express), `undici`, `node-forge`, `joi` and `passkit-generator`. Run `npm audit fix` and retest before deploying the backend. |

## Recommended before launch
1. Apply dependency updates above and rerun CI.
2. Run the `database/proposals/anonymous_function_audit.sql` review on the production project.
3. Independent penetration test of auth, payments and the public pages.
4. Rotate any keys used during development before production.
