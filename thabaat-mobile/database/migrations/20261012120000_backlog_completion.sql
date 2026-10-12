-- Backlog completion (October 12): ticket categories, attendee demographics and no-show marking.
-- Apply only after explicit approval; requires 20261005004731_ticket_checkin and 20260929_event_attendees.
BEGIN;

-- #72 Ticket categories with an optional sales cutoff (early bird).
ALTER TABLE public.ticket_types ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.ticket_types ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz;
ALTER TABLE public.ticket_types DROP CONSTRAINT IF EXISTS ticket_types_category_check;
ALTER TABLE public.ticket_types ADD CONSTRAINT ticket_types_category_check CHECK (category IN ('general','adult','child','vip','food','early_bird'));
CREATE OR REPLACE FUNCTION public.set_ticket_type_category(p_ticket_id uuid,p_category text,p_sale_ends_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; t public.ticket_types;
BEGIN
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_id FOR UPDATE;
 IF FOUND THEN SELECT * INTO e FROM public.events WHERE id=t.event_id; END IF;
 IF t.id IS NULL OR auth.uid() IS NULL OR NOT(coalesce(public.current_staff_role()='admin',false) OR (coalesce(public.current_staff_role()='organizer',false) AND e.created_by=auth.uid())) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF p_category IS NULL OR p_category NOT IN ('general','adult','child','vip','food','early_bird') THEN RAISE EXCEPTION 'Choose a valid ticket category'; END IF;
 IF p_category='early_bird' AND (p_sale_ends_at IS NULL OR p_sale_ends_at<=now() OR p_sale_ends_at>e.event_date) THEN RAISE EXCEPTION 'Early bird tickets need a sales end time before the event'; END IF;
 IF p_sale_ends_at IS NOT NULL AND p_sale_ends_at>e.event_date THEN RAISE EXCEPTION 'Sales must end before the event starts'; END IF;
 UPDATE public.ticket_types SET category=p_category,sale_ends_at=p_sale_ends_at WHERE id=t.id;
END $$;
-- Closed ticket sales cannot be booked or reactivated.
CREATE OR REPLACE FUNCTION public.enforce_ticket_sale_window() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='confirmed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') AND EXISTS(SELECT 1 FROM public.ticket_types WHERE id=NEW.ticket_type_id AND sale_ends_at IS NOT NULL AND sale_ends_at<=now()) THEN
  RAISE EXCEPTION 'Sales for this ticket have ended';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS thabaat_ticket_sale_window ON public.registrations;
CREATE TRIGGER thabaat_ticket_sale_window BEFORE INSERT OR UPDATE OF status ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_sale_window();
REVOKE ALL ON FUNCTION public.set_ticket_type_category(uuid,text,timestamptz),public.enforce_ticket_sale_window() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_ticket_type_category(uuid,text,timestamptz) TO authenticated;

-- #88 Optional self-reported demographics used to filter attendee lists.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_year integer;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_check CHECK (gender IS NULL OR gender IN ('female','male','prefer_not_to_say'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_birth_year_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_birth_year_check CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100);
CREATE OR REPLACE FUNCTION public.get_event_attendees(p_event_id uuid, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; r text; attendees jsonb; totals jsonb;
BEGIN
 r := public.current_staff_role();
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF NOT FOUND OR r IS NULL OR r NOT IN ('organizer','admin') OR (r<>'admin' AND e.created_by IS DISTINCT FROM auth.uid()) THEN
  RAISE EXCEPTION 'Event management not permitted';
 END IF;
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page offset'; END IF;
 SELECT jsonb_build_object('total',count(*),'confirmed',count(*) FILTER(WHERE status='confirmed'),'pending',count(*) FILTER(WHERE status='pending'),'cancelled',count(*) FILTER(WHERE status='cancelled'))
 INTO totals FROM public.registrations WHERE event_id=p_event_id;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.registered_at,a.registration_id),'[]'::jsonb) INTO attendees FROM (
  SELECT reg.id AS registration_id,p.full_name,t.name AS ticket_name,t.category AS ticket_category,reg.status,reg.created_at AS registered_at,
   p.gender,CASE WHEN p.birth_year IS NULL THEN NULL ELSE extract(year FROM now())::int-p.birth_year END AS age
  FROM public.registrations reg JOIN public.profiles p ON p.id=reg.user_id JOIN public.ticket_types t ON t.id=reg.ticket_type_id
  WHERE reg.event_id=p_event_id ORDER BY reg.created_at,reg.id LIMIT 50 OFFSET p_offset
 ) a;
 RETURN jsonb_build_object('attendees',attendees,'counts',totals,'capacity',e.capacity,'reserved',
  (SELECT count(*) FROM public.paid_event_orders WHERE event_id=p_event_id AND status='pending'));
END $$;
REVOKE ALL ON FUNCTION public.get_event_attendees(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(uuid,integer) TO authenticated;

-- #93 Per-attendee no-show marking after the event starts.
CREATE TABLE IF NOT EXISTS public.event_no_shows(
 registration_id uuid PRIMARY KEY REFERENCES public.registrations(id) ON DELETE CASCADE,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 marked_by uuid NOT NULL,
 marked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_no_shows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_no_shows FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.set_no_show(p_registration_id uuid,p_no_show boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations; e public.events;
BEGIN
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id;
 IF NOT FOUND OR NOT public.can_manage_staff_event(r.event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 SELECT * INTO e FROM public.events WHERE id=r.event_id;
 IF p_no_show IS NOT TRUE THEN DELETE FROM public.event_no_shows WHERE registration_id=r.id; RETURN; END IF;
 IF e.event_date>now() THEN RAISE EXCEPTION 'No-shows can be marked after the event starts'; END IF;
 IF r.status<>'confirmed' THEN RAISE EXCEPTION 'Only confirmed registrations can be marked as no-shows'; END IF;
 IF EXISTS(SELECT 1 FROM public.event_checkins WHERE registration_id=r.id) THEN RAISE EXCEPTION 'Checked-in attendees cannot be marked as no-shows'; END IF;
 INSERT INTO public.event_no_shows(registration_id,event_id,marked_by) VALUES(r.id,r.event_id,auth.uid()) ON CONFLICT (registration_id) DO NOTHING;
END $$;
-- A later check-in clears an earlier no-show mark.
CREATE OR REPLACE FUNCTION public.clear_no_show_on_checkin() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN DELETE FROM public.event_no_shows WHERE registration_id=NEW.registration_id; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS thabaat_clear_no_show ON public.event_checkins;
CREATE TRIGGER thabaat_clear_no_show AFTER INSERT ON public.event_checkins FOR EACH ROW EXECUTE FUNCTION public.clear_no_show_on_checkin();
CREATE OR REPLACE FUNCTION public.event_attendance_report(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN jsonb_build_object('confirmed',(SELECT count(*) FROM public.registrations WHERE event_id=p_event_id AND status='confirmed'),
  'checked_in',(SELECT count(*) FROM public.event_checkins c JOIN public.registrations r ON r.id=c.registration_id WHERE c.event_id=p_event_id AND r.status='confirmed'),
  'no_shows',(SELECT count(*) FROM public.event_no_shows n JOIN public.registrations r ON r.id=n.registration_id WHERE n.event_id=p_event_id AND r.status='confirmed'),
  'event_started',(SELECT event_date<=now() FROM public.events WHERE id=p_event_id),
  'attendees',coalesce((SELECT jsonb_agg(jsonb_build_object('registration_id',r.id,'full_name',p.full_name,'status',r.status,'checked_in_at',c.checked_in_at,'no_show',n.registration_id IS NOT NULL) ORDER BY r.created_at,r.id)
   FROM public.registrations r JOIN public.profiles p ON p.id=r.user_id LEFT JOIN public.event_checkins c ON c.registration_id=r.id LEFT JOIN public.event_no_shows n ON n.registration_id=r.id WHERE r.event_id=p_event_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.set_no_show(uuid,boolean),public.clear_no_show_on_checkin(),public.event_attendance_report(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_no_show(uuid,boolean),public.event_attendance_report(uuid) TO authenticated;

COMMIT;
