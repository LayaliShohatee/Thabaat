# Performance test plan and results (backlog #148)

Prepared October 12, 2026. Covers load, notifications, video playback and the ticket flow.

## Built-in performance safeguards (verified in code)
| Area | Safeguard |
|---|---|
| Attendee lists | Paged 50 at a time (`get_event_attendees`) |
| Public event list | Limited to 100 upcoming events |
| Notifications | Worker claims at most 20 jobs per run with `FOR UPDATE SKIP LOCKED`, so parallel workers never double-send; the scheduler never overlaps runs |
| Video | Streams from storage with short-lived signed URLs; background play and picture-in-picture enabled |
| Check-in roster | Refreshes every 5 seconds rather than continuously |
| Database indexes | Due-notification index; unique indexes on discount codes and open refund/membership requests |

## Load test results (October 12, 2026)
Tool: k6 1.x, script `thabaat-mobile/tests/load/public-load.k6.js`, target: thabaat-staging (Supabase free plan).
Run: `k6 run -e BASE=<supabase url> -e KEY=<publishable key> tests/load/public-load.k6.js`

| Measure | Result | Target |
|---|---|---|
| Virtual users | Ramp to 25 concurrent, 55 s | — |
| Requests | 1,932 (public event list + auth health) | — |
| Failed requests | **0.00%** | < 1% |
| Response time average | 54 ms | — |
| Response time 95th percentile | **71 ms** | < 1,000 ms |
| Slowest request | 267 ms | — |

Result: **pass**. Write-heavy load (many simultaneous paid registrations) is protected by row locks in `sandbox_purchase_ticket` / registration triggers and covered by database tests; repeat at higher volume on the client's paid production plan before launch.

## Test runs (local)
| Test | Result |
|---|---|
| Mobile automated suite (58 files, 336 tests) | About 7 seconds |
| Backend automated suite (49 tests) | Under 1 second |

## Load test to run on staging before launch
1. **Ticket flow:** 200 simulated users registering for one event within 1 minute (k6 or Artillery against the Supabase REST endpoints). Target: under 1 second per registration at the 95th percentile, no overbooking.
2. **Notifications:** queue 5,000 reminder jobs; confirm the worker drains them at 20 per run with no duplicates.
3. **Video:** 50 concurrent playback-URL requests. Target: under 500 ms each.
4. **Public pages:** 500 requests per minute to `reviewed_public_events`.

Record results here with date, tool and environment.
