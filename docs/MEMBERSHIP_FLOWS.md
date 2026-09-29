# Membership flows and Gantt coverage

Source: supplied project ZIP, `UMD Project - Thabaat /Thabaat_Backlog_Gantt_(Updated).xlsx`, first worksheet rows 76–87 (UC2 tasks 49–60). The connected Drive account could not retrieve the previously linked workbook, so this implementation uses the supplied local copy. The chart specifies Free/Paid tiers and workflows, but does not specify approved plan prices, benefits, one-time duration, discount rates or proration rules. Its completion labels are not implementation evidence.

## Test on the phone without paying

Reload the development app from this checkout, then **Profile → Membership → Practice membership flows · no charges**. The practice button appears even when billing data cannot load. The route is `/membership-preview` and is disabled in release builds.

1. Start at Free. Select one-time, monthly or annual, then review practice checkout. Access stays locked while payment is pending.
2. Simulate a verified payment. The sample member content/event becomes unlocked on this screen only.
3. Try a failed renewal: current access and the current billing period remain unchanged.
4. Cancel renewal / move to Free, then confirm. Access continues until expiry. Advance to expiry to see it lock and return to Free. Cancellation can be reversed during the current practice period.
5. Renew: active periods extend from the paid-through date; expired periods begin at the practice date. Monthly/annual periods use calendar dates clamped to month-end.
6. Preview the three-day expiry reminder and complimentary access example. Reset when finished.

**This is an in-memory rehearsal, not a CharityStack sandbox transaction.** No provider calls, Supabase writes, charges, receipts or real entitlements occur. Nothing persists after leaving the preview. One-time/complimentary examples use 30 days strictly for illustration; no live prices or benefits are invented. Preview renewal/cancellation rules are proposed behavior and still require provider/commercial validation.

## Practice events

The preview now includes **Community Welcome** (public), **Members Study Circle** and **Members Workshop** (members only). Register while Free to see the members-only denial, then simulate verified membership and register successfully. Duplicate registrations do not create extra tickets. You can cancel each practice registration. After expiry, member-event access locks; the practice registration record remains. Reset clears all practice registrations.

Browser verification on September 29: public registration succeeded without membership; Members Study Circle was blocked while Free and confirmed after simulated membership activation. These are in-memory examples, not real events or database-enforced membership gates. Members Workshop is available for the user to repeat the check.

## Real app improvements

The membership screen now distinguishes Free, Active, Complimentary, Ending soon, Expired, Payment overdue, Cancelled, Not started and Needs review from verified records. It shows an in-app reminder within seven days of expiry when refreshed. Expired records no longer claim that cancelled-renewal access continues. The same status helper drives the practice screen and real membership display. Existing database ownership protections remain unchanged.

| Gantt tasks | Current coverage | Still required |
| --- | --- | --- |
| 49–50 Free/Paid tiers and status | Real verified-record status and plan catalogue; practice selection | Approved published prices/benefits |
| 51–52 One-time/recurring purchase | Practice pending, success and failure flows | Membership checkout, provider mapping and verified server activation |
| 53–55 Renewal, cancellation, tier change | Practice renewal and Paid-to-Free at expiry; real CharityStack management guidance | Provider operations, confirmation/reconciliation, approved proration and plan-change rules |
| 56 Expiry and reminders | Date-derived real status and in-app reminder; practice time controls | Scheduled email/push delivery and reliable provider renewal sync |
| 57–58 Member content/events | Sample lock/unlock in practice only | Database-enforced gates throughout real content/event endpoints |
| 59 Membership ticket discounts | Not implemented; no approved rates | Approved eligibility/amount rules and server/provider price enforcement |
| 60 Admin complimentary membership | Practice issuance/expiry only | Role-checked administrator workflow with an audit trail |

Do not mark all UC2 tasks complete based on the practice flow. API credentials, automatic fulfillment, real cancellation and release-wide member gates remain pending. Keep work on `codex/expo57-mobile-fixes`, separate from main. No additional database migration is needed for this update.

Validation: `npm run typecheck`, `npm run lint`, and `npm test` in `thabaat-mobile`. Regression cases cover pending/failed checkout, repeat confirmation, end-of-period cancellation, expiry, renewal boundaries, leap years, complimentary access, reminders and invalid verification. Physical iPhone interaction still needs user verification.
