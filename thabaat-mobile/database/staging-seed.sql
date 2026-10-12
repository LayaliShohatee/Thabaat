-- STAGING ONLY: apply after schema.sql and 20260921_prototype_integrity.sql.
-- Synthetic event/tickets for the account and free-registration acceptance test.
-- No users, passwords, personal data, or real payments are created.
-- Repeat runs preserve existing rows and registrations; they do not reset tests.
BEGIN;

INSERT INTO public.events (id, title, description, event_date, location, capacity)
VALUES (
  '31000000-0000-4000-8000-000000000001',
  '[STAGING] Thabaat registration test',
  'Synthetic test event. Choose the free ticket to test registration; the paid ticket must remain unavailable. This is not a real event.',
  now() + interval '30 days',
  'Staging environment — no physical venue',
  20
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ticket_types (id, event_id, name, price, description, quantity)
VALUES
  (
    '42000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    'Free staging ticket', 0,
    'Use this ticket for the free-registration acceptance test.', 20
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000001',
    'Paid staging ticket — unavailable', 10,
    'Negative test only. The app and database must reject paid registration.', 20
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
