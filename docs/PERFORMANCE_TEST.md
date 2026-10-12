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
