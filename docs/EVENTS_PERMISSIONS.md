# Events and Permissions tabs

Implemented on `codex/expo57-mobile-fixes`. Membership-event gating is deliberately deferred, as requested. These tabs use actual Supabase records, unlike `/membership-preview`.

## Current behavior

- **Events:** browse/search active events, view details, create a free event with one General admission ticket, edit title/description/date/location/capacity, and archive an event that has no active registrations or pending paid orders.
- **Organizer:** create events and manage only events they own. Old events without an owner require an administrator.
- **Admin:** manage all events, search up to 20 accounts by name/email (minimum three characters), and assign/remove Volunteer, Organizer or Admin staff roles after an in-app confirmation.
- **Free/Paid:** membership status is derived separately from verified membership records. Assigning a staff role never grants paid access. Volunteer is a designation only until check-in tools are implemented.
- **Permissions:** everyone can see their own effective role and capabilities. Only administrators can search accounts or change roles. All staff changes made through the role function are audited; removal of the last administrator is rejected.

Changes to event rows and tickets are restricted to database functions. UI visibility is supplementary: the database checks caller role, event ownership, valid future dates and capacity itself. Archiving retains event/history records and blocks new free registrations and paid-order creation. Existing prices and ticket inventory are preserved during edits; increasing event capacity does not increase existing ticket quantities.

## Installation and first administrator

Apply `thabaat-mobile/database/migrations/20260929_events_permissions.sql` after the prototype-integrity, membership-billing and paid-event migrations. It does not depend on the optional CharityStack transport migration. Repeat application is supported. This migration was applied successfully to **staging `qyxggeyqbebezlolvztf` on September 29, 2026**. The original team database is untouched.

The migration does not grant anyone a staff role. Bootstrap the first administrator only after the account/project owner approves the specific account. Use a trusted SQL Editor operator; there is no unauthenticated bootstrap endpoint. Verify the account ID/email in `profiles`, then run this transaction with the approved UUID:

```sql
BEGIN;
-- Replace the placeholder with the approved existing profile UUID.
INSERT INTO public.staff_roles(user_id, role)
VALUES ('<approved-profile-uuid>', 'admin');
INSERT INTO public.role_audit(actor_id,target_id,previous_role,new_role)
VALUES ('<approved-profile-uuid>','<approved-profile-uuid>',NULL,'admin');
COMMIT;
```

Refresh **Permissions** after bootstrapping. Subsequent changes use the app and `set_staff_role`, which serializes role changes, checks current administrator privileges and records an audit row. Never add role authority to client-editable profile metadata or signup fields.

## Test checklist

1. A regular account sees its own permissions, event listings and details; it cannot create events, search user accounts, or assign roles.
2. An organizer creates a free future event and edits it; the organizer cannot edit/archive someone else's event.
3. An administrator can edit any event and assign staff roles, but cannot remove the last administrator.
4. An event with active registrations/pending paid reservations cannot be archived, and capacity cannot fall below occupied/reserved seats.
5. An archived event disappears from listings and rejects new registration at the database even if the client sends a direct request.

Automated coverage: 12 database tests for these rules; all 119 mobile tests pass, as do typecheck/lint. Hosted verification confirmed schema installation and a signed-in Free account's restricted Permissions view. Admin browser workflows require the approved first-admin grant.

## Remaining event/admin scope

Image uploads, custom ticket inventory/prices, paid checkout configuration, attendee management, event cancellation/refunds, waitlists, QR check-in, demographic restrictions, ticket transfer/gifting, calendar integration, membership restrictions, and role-based administration of other modules are not implemented by these tabs. Staff role audit viewing and an archive restore UI are also pending; archived rows remain recoverable by a trusted database operator. This is a focused event-management/role foundation, not completion of all UC3/UC4/UC9 tasks.

No paid plan prices, staff assignments, or actual payment outcomes are inferred from the Gantt. Keep main separate and unmerged.
