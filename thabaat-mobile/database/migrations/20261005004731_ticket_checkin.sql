-- After staff_volunteer_reporting. Credential is private and never derived from a registration identifier.
BEGIN;
CREATE TABLE public.ticket_credentials (
 registration_id uuid PRIMARY KEY REFERENCES public.registrations(id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
 issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.event_checkins (
 registration_id uuid PRIMARY KEY REFERENCES public.registrations(id), event_id uuid NOT NULL REFERENCES public.events(id),
 checked_in_by uuid NOT NULL REFERENCES public.profiles(id), checked_in_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_checkins_event_idx ON public.event_checkins(event_id);
ALTER TABLE public.ticket_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_credentials,public.event_checkins FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ticket_credentials,public.event_checkins TO service_role;
CREATE FUNCTION public.invalidate_ticket_on_status_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='cancelled' AND EXISTS(SELECT 1 FROM public.event_checkins WHERE registration_id=NEW.id) THEN RAISE EXCEPTION 'Checked-in tickets require event manager review before cancellation'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.ticket_type_id IS DISTINCT FROM OLD.ticket_type_id THEN DELETE FROM public.ticket_credentials WHERE registration_id=NEW.id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invalidate_ticket_status AFTER UPDATE OF status,user_id,ticket_type_id ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.invalidate_ticket_on_status_change();
CREATE FUNCTION public.get_my_ticket(p_registration_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations; e public.events; credential text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR r.status<>'confirmed' THEN RAISE EXCEPTION 'Confirmed ticket not found'; END IF;
 SELECT * INTO e FROM public.events WHERE id=r.event_id;
 IF e.archived OR e.event_date+interval '24 hours'<now() THEN RAISE EXCEPTION 'Ticket is no longer valid'; END IF;
 IF coalesce((to_jsonb(e)->>'members_only')::boolean,false) AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=r.user_id AND m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now()) THEN RAISE EXCEPTION 'Active membership required for this event ticket'; END IF;
 INSERT INTO public.ticket_credentials(registration_id) VALUES(r.id) ON CONFLICT(registration_id) DO NOTHING;
 SELECT token INTO credential FROM public.ticket_credentials WHERE registration_id=r.id;
 RETURN jsonb_build_object('registration_id',r.id,'event_id',r.event_id,'title',e.title,'event_date',e.event_date,'location',e.location,'ticket_name',(SELECT name FROM public.ticket_types WHERE id=r.ticket_type_id),'token',credential,'checked_in_at',(SELECT checked_in_at FROM public.event_checkins WHERE registration_id=r.id));
END $$;
CREATE FUNCTION public.check_in_ticket(p_event_id uuid,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations; e public.events; previous public.event_checkins; inserted_count integer;
BEGIN
 IF NOT coalesce(public.can_staff_event(p_event_id),false) THEN RAISE EXCEPTION 'Active event staff assignment required'; END IF;
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid ticket code'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF e.archived OR now()<e.event_date-interval '4 hours' OR now()>e.event_date+interval '24 hours' THEN RAISE EXCEPTION 'Check-in is outside the event window'; END IF;
 SELECT reg.* INTO r FROM public.registrations reg JOIN public.ticket_credentials c ON c.registration_id=reg.id WHERE c.token=p_token AND reg.event_id=p_event_id FOR UPDATE OF reg;
 IF NOT FOUND OR r.status<>'confirmed' THEN RAISE EXCEPTION 'Ticket is invalid or belongs to another event'; END IF;
 IF coalesce((to_jsonb(e)->>'members_only')::boolean,false) AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=r.user_id AND m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now()) THEN RAISE EXCEPTION 'Active membership required for this event ticket'; END IF;
 -- Recheck the token after acquiring registration lock; cancellation may have invalidated it while waiting.
 IF NOT EXISTS(SELECT 1 FROM public.ticket_credentials WHERE registration_id=r.id AND token=p_token) THEN RAISE EXCEPTION 'Ticket has been invalidated'; END IF;
 INSERT INTO public.event_checkins(registration_id,event_id,checked_in_by) VALUES(r.id,p_event_id,auth.uid()) ON CONFLICT(registration_id) DO NOTHING;
 GET DIAGNOSTICS inserted_count = ROW_COUNT;
 SELECT * INTO previous FROM public.event_checkins WHERE registration_id=r.id;
 RETURN jsonb_build_object('registration_id',r.id,'full_name',(SELECT full_name FROM public.profiles WHERE id=r.user_id),'ticket_name',(SELECT name FROM public.ticket_types WHERE id=r.ticket_type_id),'checked_in_at',previous.checked_in_at,'already_checked_in',inserted_count=0);
END $$;
CREATE FUNCTION public.event_attendance_report(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN jsonb_build_object('confirmed',(SELECT count(*) FROM public.registrations WHERE event_id=p_event_id AND status='confirmed'),'checked_in',(SELECT count(*) FROM public.event_checkins c JOIN public.registrations r ON r.id=c.registration_id WHERE c.event_id=p_event_id AND r.status='confirmed'),'attendees',coalesce((SELECT jsonb_agg(jsonb_build_object('registration_id',r.id,'full_name',p.full_name,'status',r.status,'checked_in_at',c.checked_in_at) ORDER BY r.created_at,r.id) FROM public.registrations r JOIN public.profiles p ON p.id=r.user_id LEFT JOIN public.event_checkins c ON c.registration_id=r.id WHERE r.event_id=p_event_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.invalidate_ticket_on_status_change(),public.get_my_ticket(uuid),public.check_in_ticket(uuid,text),public.event_attendance_report(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_ticket(uuid),public.check_in_ticket(uuid,text),public.event_attendance_report(uuid) TO authenticated;
COMMIT;
