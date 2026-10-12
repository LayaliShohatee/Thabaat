# Thabaat admin guide (backlog #155)

For organizers, volunteers with check-in duties and administrators.

## Roles
| Role | Can do |
|---|---|
| Volunteer | Check in attendees for assigned events, record shift arrival/departure |
| Organizer | Everything for events they created: edit, tickets, attendees, refunds, discount codes, check-in |
| Administrator | All events, roles, account suspension, memberships and tiers, campaigns, broadcasts, public pages, analytics |

Assign roles in the **Permissions** tab.

## Events (Events tab)
Each event is a collapsed row. Tap it to show its tools.
- **Create free event:** fill in title, description, date (`2026-10-20T18:00`), location and capacity. **Upload flyer image** adds a poster (JPEG/PNG/WebP, up to 5 MB).
- **Manage ticket types:** add tickets with a category (General, Adult, Child, VIP, Food, Early bird). Early bird tickets need a sales end time.
- **Refunds and discount codes:** set the refund deadline, approve or decline refund requests (then return the money in CharityStack), and create discount codes (percent or dollars off, use limit, expiry).
- **Public page (admins):** choose the title, summary and venue shown to people who are not signed in, then **Publish public page**. Members-only events cannot be public.
- **Show attendees:** filter by gender and age group; see ticket categories.
- **Manage waitlist**, **Check in** and **Archive** as before.

## Check-in
Events → event → **Check in**. Scan the QR or type the code. After the event starts, open **View attendee check-ins** to mark individual **no-shows**. **Export attendance CSV** includes a No-show column.

## Memberships (Staff memberships screen)
- **Membership tiers:** add or edit plans: price, billing period, benefits, CharityStack checkout link, **member ticket discount %** and whether it is published.
- **Membership change requests:** members ask to stop or keep renewing or switch plans. Make the change in CharityStack first, then tap **Confirm**.
- Complimentary memberships can be issued and revoked here.

## Notifications
- **Broadcasts:** open the **Notification broadcast** staff screen. Target by category, event, members only or assigned volunteers.
- **Automatic notifications:** registration confirmations, event reminders, membership expiry, new-video alerts and volunteer shift reminders. These are sent by the backend when `NOTIFICATIONS_ENABLED=true` is set on the server.

## Donations
Staff campaigns: create, edit, feature and archive campaigns, set goals, and export donor data.

## Volunteers
Review applications in Permissions, assign shifts with duty and times, review hours. Approved volunteers complete onboarding in the app.

## Reports
Staff analytics: events, attendance, revenue and fundraising summaries, with CSV exports for registrations, memberships, donations and attendance.

## Database changes (developers)
New features ship as migration files in `thabaat-mobile/database/migrations`. Apply them to the hosted Supabase project in order, one at a time, only after approval. The October 12 files are `20261012120000` through `20261012120300`. The anonymous access in `20261012120300` needs the stakeholder's public-visibility approval.

## Test payments (sandbox)
The client is not using CharityStack, so payments run in **test mode** for development and demos: no money moves, and every test payment ID starts with `sandbox_`.
- Turn it on or off on the **Staff memberships** screen → **Test payments**. It is currently **ON** for the thabaat-staging project.
- With test mode on: members can **Join/Renew** membership plans, **Give $10/$25/$50** to campaigns, and **Pay** for paid tickets (member discount and discount codes are applied on the server). Approved refunds mark the test payment refunded.
- Turn test mode **OFF** before any real launch, and connect a real payment provider at that point.
