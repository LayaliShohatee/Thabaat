-- REVIEW AND APPLY IN A STAGING SUPABASE PROJECT FIRST.
-- Not applied automatically. Targets the live prototype's event_date column.
-- Existing duplicate data or incompatible column types must be resolved by the owner.
-- Review existing RLS policies: PostgreSQL permissive policies combine with OR.
BEGIN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 100;
ALTER TABLE public.ticket_types ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 50;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token text;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_user_event_unique ON public.registrations(user_id, event_id);

-- Create/synchronize the profile required by registrations for new and existing users.
CREATE OR REPLACE FUNCTION public.sync_auth_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS thabaat_sync_auth_profile ON auth.users;
CREATE TRIGGER thabaat_sync_auth_profile AFTER INSERT OR UPDATE OF email, raw_user_meta_data
ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_auth_profile();
INSERT INTO public.profiles(id, email, full_name)
SELECT id, COALESCE(email, ''), COALESCE(raw_user_meta_data->>'full_name', '') FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Serialize reservations for an event and reject invalid/free-checkout bypasses.
-- Paid checkout remains disabled until trusted payment verification is implemented.
CREATE OR REPLACE FUNCTION public.validate_free_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  event_row public.events%ROWTYPE;
  ticket_row public.ticket_types%ROWTYPE;
  used integer;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only register yourself';
  END IF;
  SELECT * INTO event_row FROM public.events WHERE id = NEW.event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF event_row.event_date <= now() THEN RAISE EXCEPTION 'Registration is closed for this event'; END IF;
  SELECT * INTO ticket_row FROM public.ticket_types WHERE id = NEW.ticket_type_id;
  IF NOT FOUND OR ticket_row.event_id <> NEW.event_id THEN RAISE EXCEPTION 'Ticket does not belong to this event'; END IF;
  IF ticket_row.price > 0 THEN RAISE EXCEPTION 'Paid checkout is not available yet'; END IF;
  SELECT count(*) INTO used FROM public.registrations WHERE event_id = NEW.event_id AND status <> 'cancelled';
  IF used >= event_row.capacity THEN RAISE EXCEPTION 'Event is sold out'; END IF;
  SELECT count(*) INTO used FROM public.registrations WHERE ticket_type_id = NEW.ticket_type_id AND status <> 'cancelled';
  IF used >= ticket_row.quantity THEN RAISE EXCEPTION 'Ticket type is sold out'; END IF;
  NEW.status := 'confirmed';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS thabaat_validate_registration ON public.registrations;
CREATE TRIGGER thabaat_validate_registration BEFORE INSERT ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.validate_free_registration();
REVOKE ALL ON FUNCTION public.sync_auth_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_free_registration() FROM PUBLIC;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS thabaat_profiles_select_self ON public.profiles;
CREATE POLICY thabaat_profiles_select_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS thabaat_profiles_insert_self ON public.profiles;
CREATE POLICY thabaat_profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS thabaat_profiles_update_self ON public.profiles;
CREATE POLICY thabaat_profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS thabaat_events_read ON public.events;
CREATE POLICY thabaat_events_read ON public.events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS thabaat_tickets_read ON public.ticket_types;
CREATE POLICY thabaat_tickets_read ON public.ticket_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS thabaat_registrations_select_self ON public.registrations;
CREATE POLICY thabaat_registrations_select_self ON public.registrations FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS thabaat_registrations_insert_self ON public.registrations;
CREATE POLICY thabaat_registrations_insert_self ON public.registrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
COMMIT;
