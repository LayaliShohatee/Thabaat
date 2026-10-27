-- Client feedback phase 4: required age/gender on accounts, several tickets per account with per-attendee details,
-- one scan shows the whole booking at check-in, and the full volunteer interest form (matches the client's Google form).
-- After 20261014130100_checkin_roster_window. Older app builds keep working: single bookings stay one per account per event.
-- Every replaced privileged function keeps the suspended-account guard that 20261005023000 added to them.
-- Applied to the thabaat-staging development project on 2026-10-26.
BEGIN;

-- Profiles: sign-up sends gender and birth_year in auth metadata; existing accounts complete them once.
CREATE OR REPLACE FUNCTION public.sync_auth_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g text:=NEW.raw_user_meta_data->>'gender'; y text:=NEW.raw_user_meta_data->>'birth_year';
BEGIN
 IF g IS NULL OR g NOT IN ('female','male','prefer_not_to_say') THEN g:=NULL; END IF;
 IF y IS NULL OR y !~ '^[0-9]{4}$' OR y::integer NOT BETWEEN 1900 AND extract(year FROM now())::integer THEN y:=NULL; END IF;
 INSERT INTO public.profiles(id,email,full_name,gender,birth_year)
 VALUES (NEW.id,COALESCE(NEW.email,''),COALESCE(NEW.raw_user_meta_data->>'full_name',''),g,y::integer)
 ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,full_name=EXCLUDED.full_name,
  gender=coalesce(EXCLUDED.gender,public.profiles.gender),birth_year=coalesce(EXCLUDED.birth_year,public.profiles.birth_year);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_my_profile(p_age integer,p_gender text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.assert_active_account();
 IF p_age IS NULL OR p_age NOT BETWEEN 13 AND 120 THEN RAISE EXCEPTION 'Enter an age from 13 to 120'; END IF;
 IF p_gender IS NULL OR p_gender NOT IN ('female','male','prefer_not_to_say') THEN RAISE EXCEPTION 'Choose a gender option'; END IF;
 UPDATE public.profiles SET birth_year=extract(year FROM now())::integer-p_age,gender=p_gender WHERE id=auth.uid();
END $$;

-- Tickets: one row per attendee. order_id groups tickets booked together; legacy single bookings have no order_id.
ALTER TABLE public.registrations
 ADD COLUMN IF NOT EXISTS order_id uuid,
 ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS attendee_first_name text CHECK(attendee_first_name IS NULL OR length(attendee_first_name) BETWEEN 1 AND 60),
 ADD COLUMN IF NOT EXISTS attendee_last_name text CHECK(attendee_last_name IS NULL OR length(attendee_last_name) BETWEEN 1 AND 60),
 ADD COLUMN IF NOT EXISTS attendee_email text CHECK(attendee_email IS NULL OR length(attendee_email)<=254),
 ADD COLUMN IF NOT EXISTS attendee_birth_year integer CHECK(attendee_birth_year IS NULL OR attendee_birth_year BETWEEN 1900 AND 2100),
 ADD COLUMN IF NOT EXISTS attendee_gender text CHECK(attendee_gender IS NULL OR attendee_gender IN ('female','male','prefer_not_to_say'));
DROP INDEX IF EXISTS public.registrations_user_event_unique;
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_user_id_event_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_single_booking_unique ON public.registrations(user_id,event_id) WHERE order_id IS NULL;
CREATE INDEX IF NOT EXISTS registrations_user_event_idx ON public.registrations(user_id,event_id);

CREATE OR REPLACE FUNCTION public.attendee_display_name(p_first text,p_last text,p_fallback text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(nullif(trim(concat_ws(' ',p_first,p_last)),''),p_fallback)
$$;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ask_social_time boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.set_event_social_question(p_event_id uuid,p_ask boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.assert_active_account();
 IF NOT coalesce(public.can_manage_staff_event(p_event_id),false) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 UPDATE public.events SET ask_social_time=coalesce(p_ask,false) WHERE id=p_event_id;
END $$;

-- Once-per-booking answers. Readable by staff through RPCs only.
CREATE TABLE IF NOT EXISTS public.registration_answers (
 order_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 heard_from text NOT NULL CHECK(length(heard_from) BETWEEN 1 AND 100),
 first_event boolean NOT NULL,
 social_time boolean,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.registration_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_answers FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.registration_answers TO service_role;

-- p_tickets: [{ticket_type_id, self, first_name, last_name, email, age, gender}]; p_answers: {heard_from, first_event, social_time}.
CREATE OR REPLACE FUNCTION public.reserve_free_tickets(p_event_id uuid,p_tickets jsonb,p_answers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; t public.ticket_types; me public.profiles; item jsonb; r public.registrations;
 order_uuid uuid:=gen_random_uuid(); ids uuid[]:='{}'; n integer; is_me boolean; first_name text; last_name text; email text; age text; gender text; social boolean;
BEGIN
 PERFORM public.assert_active_account();
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR e.archived THEN RAISE EXCEPTION 'Event is unavailable'; END IF;
 IF e.event_date<=now() THEN RAISE EXCEPTION 'Registration is closed'; END IF;
 IF p_tickets IS NULL OR jsonb_typeof(p_tickets)<>'array' THEN RAISE EXCEPTION 'Choose at least one ticket'; END IF;
 n:=jsonb_array_length(p_tickets);
 IF n NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Choose between 1 and 10 tickets'; END IF;
 IF (SELECT count(*) FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id AND status<>'cancelled')+n>10 THEN
  RAISE EXCEPTION 'An account can hold at most 10 tickets for one event';
 END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_tickets) x WHERE x->>'self'='true')>1 THEN RAISE EXCEPTION 'Only one ticket can be for you'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_tickets) x WHERE x->>'self'='true')
  AND EXISTS(SELECT 1 FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id AND status<>'cancelled' AND is_self) THEN
  RAISE EXCEPTION 'You already have a ticket for yourself at this event';
 END IF;
 IF p_answers IS NULL OR jsonb_typeof(p_answers)<>'object' OR length(trim(coalesce(p_answers->>'heard_from','')))=0 THEN RAISE EXCEPTION 'Tell us how you heard about this event'; END IF;
 IF coalesce(p_answers->>'first_event','') NOT IN ('true','false') THEN RAISE EXCEPTION 'Tell us whether this is your first Thabaat event'; END IF;
 IF e.ask_social_time THEN
  IF coalesce(p_answers->>'social_time','') NOT IN ('true','false') THEN RAISE EXCEPTION 'Tell us whether you will attend social time'; END IF;
  social:=(p_answers->>'social_time')::boolean;
 END IF;
 SELECT * INTO me FROM public.profiles WHERE id=auth.uid();

 FOR item IN SELECT value FROM jsonb_array_elements(p_tickets) LOOP
  IF coalesce(item->>'ticket_type_id','') !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'Ticket does not belong to this event'; END IF;
  SELECT * INTO t FROM public.ticket_types WHERE id=(item->>'ticket_type_id')::uuid;
  IF NOT FOUND OR t.event_id<>e.id THEN RAISE EXCEPTION 'Ticket does not belong to this event'; END IF;
  IF t.price<>0 THEN RAISE EXCEPTION 'Paid checkout requires verified payment'; END IF;
  IF public.event_reserved_seats(e.id)>=e.capacity THEN RAISE EXCEPTION 'Event is sold out'; END IF;
  IF public.event_reserved_seats(e.id,t.id)>=t.quantity THEN RAISE EXCEPTION '% is sold out',t.name; END IF;
  is_me:=item->>'self'='true';
  IF is_me THEN
   IF me.gender IS NULL OR me.birth_year IS NULL THEN RAISE EXCEPTION 'Add your age and gender to your profile first'; END IF;
   INSERT INTO public.registrations(user_id,event_id,ticket_type_id,status,order_id,is_self,attendee_email,attendee_birth_year,attendee_gender)
   VALUES(auth.uid(),e.id,t.id,'confirmed',order_uuid,true,me.email,me.birth_year,me.gender) RETURNING * INTO r;
  ELSE
   first_name:=trim(coalesce(item->>'first_name','')); last_name:=trim(coalesce(item->>'last_name',''));
   email:=lower(trim(coalesce(item->>'email',''))); age:=trim(coalesce(item->>'age','')); gender:=item->>'gender';
   IF length(first_name) NOT BETWEEN 1 AND 60 OR length(last_name) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Enter each guest''s first and last name'; END IF;
   IF length(email)>254 OR email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'Enter a valid email for %',first_name; END IF;
   IF age !~ '^[0-9]{1,3}$' OR age::integer NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Enter an age for %',first_name; END IF;
   IF gender IS NULL OR gender NOT IN ('female','male','prefer_not_to_say') THEN RAISE EXCEPTION 'Choose a gender for %',first_name; END IF;
   INSERT INTO public.registrations(user_id,event_id,ticket_type_id,status,order_id,is_self,attendee_first_name,attendee_last_name,attendee_email,attendee_birth_year,attendee_gender)
   VALUES(auth.uid(),e.id,t.id,'confirmed',order_uuid,false,first_name,last_name,email,extract(year FROM now())::integer-age::integer,gender) RETURNING * INTO r;
  END IF;
  -- shortcut: each ticket logs 'registered', so a booking of N tickets queues N confirmation pushes; dedupe per order when push delivery goes live.
  INSERT INTO public.registration_history(registration_id,user_id,event_id,action) VALUES(r.id,auth.uid(),e.id,'registered');
  ids:=ids||r.id;
 END LOOP;
 INSERT INTO public.registration_answers(order_id,user_id,event_id,heard_from,first_event,social_time)
 VALUES(order_uuid,auth.uid(),e.id,left(trim(p_answers->>'heard_from'),100),(p_answers->>'first_event')::boolean,social);
 RETURN jsonb_build_object('order_id',order_uuid,'registration_ids',to_jsonb(ids));
END $$;

-- Check-in: any ticket QR from an account shows every confirmed ticket that account holds for the event.
-- p_registration_ids: NULL checks in all of them, '{}' only previews, a list checks in just those.
CREATE OR REPLACE FUNCTION public.check_in_party(p_event_id uuid,p_token text,p_registration_ids uuid[] DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; r public.registrations; newly uuid[];
BEGIN
 PERFORM public.assert_active_account();
 IF NOT coalesce(public.can_staff_event(p_event_id),false) THEN RAISE EXCEPTION 'Active event staff assignment required'; END IF;
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid ticket code'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF NOT FOUND OR e.archived OR now()<e.event_date-interval '4 hours' OR now()>e.event_date+interval '24 hours' THEN RAISE EXCEPTION 'Check-in is outside the event window'; END IF;
 SELECT reg.* INTO r FROM public.registrations reg JOIN public.ticket_credentials c ON c.registration_id=reg.id WHERE c.token=p_token AND reg.event_id=p_event_id FOR UPDATE OF reg;
 IF NOT FOUND OR r.status<>'confirmed' OR NOT public.account_is_active(r.user_id) THEN RAISE EXCEPTION 'Ticket is invalid or belongs to another event'; END IF;
 IF e.members_only AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=r.user_id AND m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now()) THEN RAISE EXCEPTION 'Active membership required for this event ticket'; END IF;
 -- Recheck the token after acquiring the lock; cancellation may have invalidated it while waiting.
 IF NOT EXISTS(SELECT 1 FROM public.ticket_credentials WHERE registration_id=r.id AND token=p_token) THEN RAISE EXCEPTION 'Ticket has been invalidated'; END IF;
 PERFORM 1 FROM public.registrations WHERE user_id=r.user_id AND event_id=p_event_id AND status='confirmed' FOR UPDATE;
 IF p_registration_ids IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(p_registration_ids) x WHERE NOT EXISTS(
  SELECT 1 FROM public.registrations WHERE id=x AND user_id=r.user_id AND event_id=p_event_id AND status='confirmed')) THEN
  RAISE EXCEPTION 'Ticket is not part of this booking';
 END IF;
 WITH ins AS (
  INSERT INTO public.event_checkins(registration_id,event_id,checked_in_by)
  SELECT id,p_event_id,auth.uid() FROM public.registrations
  WHERE user_id=r.user_id AND event_id=p_event_id AND status='confirmed' AND (p_registration_ids IS NULL OR id=ANY(p_registration_ids))
  ON CONFLICT(registration_id) DO NOTHING RETURNING registration_id)
 SELECT coalesce(array_agg(registration_id),'{}') INTO newly FROM ins;
 RETURN jsonb_build_object('account_name',(SELECT full_name FROM public.profiles WHERE id=r.user_id),'scanned_registration_id',r.id,
  'tickets',(SELECT jsonb_agg(jsonb_build_object('registration_id',x.id,'full_name',public.attendee_display_name(x.attendee_first_name,x.attendee_last_name,p.full_name),
    'ticket_name',t.name,'checked_in_at',c.checked_in_at,'just_checked_in',x.id=ANY(newly)) ORDER BY x.is_self DESC,x.created_at,x.id)
   FROM public.registrations x JOIN public.profiles p ON p.id=x.user_id JOIN public.ticket_types t ON t.id=x.ticket_type_id LEFT JOIN public.event_checkins c ON c.registration_id=x.id
   WHERE x.user_id=r.user_id AND x.event_id=p_event_id AND x.status='confirmed'));
END $$;

-- Same as 20261005004731 plus attendee_name, so a guest's ticket says whose it is.
CREATE OR REPLACE FUNCTION public.get_my_ticket(p_registration_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations; e public.events; credential text;
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR r.status<>'confirmed' THEN RAISE EXCEPTION 'Confirmed ticket not found'; END IF;
 SELECT * INTO e FROM public.events WHERE id=r.event_id;
 IF e.archived OR e.event_date+interval '24 hours'<now() THEN RAISE EXCEPTION 'Ticket is no longer valid'; END IF;
 IF coalesce((to_jsonb(e)->>'members_only')::boolean,false) AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=r.user_id AND m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now()) THEN RAISE EXCEPTION 'Active membership required for this event ticket'; END IF;
 INSERT INTO public.ticket_credentials(registration_id) VALUES(r.id) ON CONFLICT(registration_id) DO NOTHING;
 SELECT token INTO credential FROM public.ticket_credentials WHERE registration_id=r.id;
 RETURN jsonb_build_object('registration_id',r.id,'event_id',r.event_id,'title',e.title,'event_date',e.event_date,'location',e.location,'ticket_name',(SELECT name FROM public.ticket_types WHERE id=r.ticket_type_id),'token',credential,'checked_in_at',(SELECT checked_in_at FROM public.event_checkins WHERE registration_id=r.id),
  'attendee_name',CASE WHEN r.is_self THEN NULL ELSE public.attendee_display_name(r.attendee_first_name,r.attendee_last_name,NULL) END);
END $$;

-- Rosters and check-in results show the guest's name rather than the account holder's.
CREATE OR REPLACE FUNCTION public.event_checkin_roster(p_event_id uuid,p_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE needle text:='%'||replace(replace(replace(lower(trim(coalesce(p_search,''))),'\','\\'),'%','\%'),'_','\_')||'%'; e public.events;
BEGIN
 PERFORM public.assert_active_account();
 IF NOT public.can_view_event_roster(p_event_id) THEN RAISE EXCEPTION 'Event staff access required'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 RETURN jsonb_build_object(
  'can_check_in',coalesce(public.can_staff_event(p_event_id),false) AND NOT e.archived AND now() BETWEEN e.event_date-interval '4 hours' AND e.event_date+interval '24 hours',
  'check_in_opens_at',e.event_date-interval '4 hours',
  'capacity',e.capacity,
  'confirmed',(SELECT count(*) FROM public.registrations WHERE event_id=p_event_id AND status='confirmed'),
  'checked_in',(SELECT count(*) FROM public.event_checkins c JOIN public.registrations r ON r.id=c.registration_id WHERE c.event_id=p_event_id AND r.status='confirmed'),
  'walk_ins',(SELECT count(*) FROM public.event_walk_ins WHERE event_id=p_event_id),
  'people',coalesce((SELECT jsonb_agg(x ORDER BY lower(x->>'full_name'),x->>'id') FROM (
    SELECT jsonb_build_object('kind','registration','id',r.id,'full_name',public.attendee_display_name(r.attendee_first_name,r.attendee_last_name,p.full_name),'ticket_name',t.name,'checked_in_at',c.checked_in_at) x
     FROM public.registrations r JOIN public.profiles p ON p.id=r.user_id JOIN public.ticket_types t ON t.id=r.ticket_type_id LEFT JOIN public.event_checkins c ON c.registration_id=r.id
     WHERE r.event_id=p_event_id AND r.status='confirmed'
      AND (lower(public.attendee_display_name(r.attendee_first_name,r.attendee_last_name,p.full_name)) LIKE needle OR lower(p.full_name) LIKE needle)
    UNION ALL
    SELECT jsonb_build_object('kind','walk_in','id',w.id,'full_name',w.full_name,'ticket_name','Walk-in','checked_in_at',w.checked_in_at)
     FROM public.event_walk_ins w WHERE w.event_id=p_event_id AND lower(w.full_name) LIKE needle
    LIMIT 300) people),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.check_in_registration(p_event_id uuid,p_registration_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations; e public.events; previous public.event_checkins; inserted_count integer;
BEGIN
 PERFORM public.assert_active_account();
 IF NOT coalesce(public.can_staff_event(p_event_id),false) THEN RAISE EXCEPTION 'Active event staff assignment required'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF NOT FOUND OR e.archived OR now()<e.event_date-interval '4 hours' OR now()>e.event_date+interval '24 hours' THEN RAISE EXCEPTION 'Check-in is outside the event window'; END IF;
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id AND event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'confirmed' OR NOT public.account_is_active(r.user_id) THEN RAISE EXCEPTION 'Registration is not confirmed for this event'; END IF;
 IF e.members_only AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=r.user_id AND m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now()) THEN RAISE EXCEPTION 'Active membership required for this event'; END IF;
 INSERT INTO public.event_checkins(registration_id,event_id,checked_in_by) VALUES(r.id,p_event_id,auth.uid()) ON CONFLICT(registration_id) DO NOTHING;
 GET DIAGNOSTICS inserted_count = ROW_COUNT;
 SELECT * INTO previous FROM public.event_checkins WHERE registration_id=r.id;
 RETURN jsonb_build_object('registration_id',r.id,'full_name',public.attendee_display_name(r.attendee_first_name,r.attendee_last_name,(SELECT full_name FROM public.profiles WHERE id=r.user_id)),
  'ticket_name',(SELECT name FROM public.ticket_types WHERE id=r.ticket_type_id),'checked_in_at',previous.checked_in_at,'already_checked_in',inserted_count=0);
END $$;

CREATE OR REPLACE FUNCTION public.get_event_attendees(p_event_id uuid, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; r text; attendees jsonb; totals jsonb;
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 r := public.current_staff_role();
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF NOT FOUND OR r IS NULL OR r NOT IN ('organizer','admin') OR (r<>'admin' AND e.created_by IS DISTINCT FROM auth.uid()) THEN
  RAISE EXCEPTION 'Event management not permitted';
 END IF;
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page offset'; END IF;
 SELECT jsonb_build_object('total',count(*),'confirmed',count(*) FILTER(WHERE status='confirmed'),'pending',count(*) FILTER(WHERE status='pending'),'cancelled',count(*) FILTER(WHERE status='cancelled'))
 INTO totals FROM public.registrations WHERE event_id=p_event_id;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.registered_at,a.registration_id),'[]'::jsonb) INTO attendees FROM (
  SELECT reg.id AS registration_id,public.attendee_display_name(reg.attendee_first_name,reg.attendee_last_name,p.full_name) AS full_name,
   CASE WHEN reg.is_self THEN NULL ELSE p.full_name END AS booked_by,t.name AS ticket_name,t.category AS ticket_category,reg.status,reg.created_at AS registered_at,
   coalesce(reg.attendee_gender,p.gender) AS gender,
   CASE WHEN coalesce(reg.attendee_birth_year,p.birth_year) IS NULL THEN NULL ELSE extract(year FROM now())::int-coalesce(reg.attendee_birth_year,p.birth_year) END AS age,
   ans.heard_from,ans.first_event,ans.social_time
  FROM public.registrations reg JOIN public.profiles p ON p.id=reg.user_id JOIN public.ticket_types t ON t.id=reg.ticket_type_id
  LEFT JOIN public.registration_answers ans ON ans.order_id=reg.order_id
  WHERE reg.event_id=p_event_id ORDER BY reg.created_at,reg.id LIMIT 50 OFFSET p_offset
 ) a;
 RETURN jsonb_build_object('attendees',attendees,'counts',totals,'capacity',e.capacity,'reserved',
  (SELECT count(*) FROM public.paid_event_orders WHERE event_id=p_event_id AND status='pending'));
END $$;

-- Volunteer interest form: the client's Google form questions, validated here. Answers live in one jsonb column.
ALTER TABLE public.volunteer_applications
 ADD COLUMN IF NOT EXISTS answers jsonb,
 ADD COLUMN IF NOT EXISTS resume_path text;

CREATE OR REPLACE FUNCTION public.submit_volunteer_interest(p_answers jsonb,p_resume_path text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; clean jsonb:='{}'::jsonb; v text;
BEGIN
 PERFORM public.assert_active_account();
 IF p_answers IS NULL OR jsonb_typeof(p_answers)<>'object' THEN RAISE EXCEPTION 'Answers are required'; END IF;
 FOREACH k IN ARRAY ARRAY['email','name','phone','city_state','profession','experience','why_join','attendance_frequency'] LOOP
  v:=trim(coalesce(p_answers->>k,''));
  IF length(v)=0 THEN RAISE EXCEPTION 'Please answer every required question'; END IF;
  IF length(v)>2000 THEN RAISE EXCEPTION 'Answers must be 2000 characters or fewer'; END IF;
  clean:=clean||jsonb_build_object(k,v);
 END LOOP;
 IF (clean->>'email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'Enter a valid email'; END IF;
 IF coalesce(p_answers->>'age','') !~ '^[0-9]{1,3}$' OR (p_answers->>'age')::integer NOT BETWEEN 23 AND 120 THEN RAISE EXCEPTION 'Volunteers must be 23 or older'; END IF;
 IF coalesce(p_answers->>'gender','') NOT IN ('male','female') THEN RAISE EXCEPTION 'Choose a gender'; END IF;
 clean:=clean||jsonb_build_object('age',(p_answers->>'age')::integer,'gender',p_answers->>'gender');
 FOREACH k IN ARRAY ARRAY['hours_per_month','available_days','contribute_as','anchor_programs'] LOOP
  IF jsonb_typeof(p_answers->k)<>'array' OR jsonb_array_length(p_answers->k) NOT BETWEEN 1 AND 10
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers->k) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 200) THEN
   RAISE EXCEPTION 'Please answer every required question';
  END IF;
  clean:=clean||jsonb_build_object(k,p_answers->k);
 END LOOP;
 FOREACH k IN ARRAY ARRAY['media_skills','referred_by'] LOOP
  v:=left(trim(coalesce(p_answers->>k,'')),2000); IF v<>'' THEN clean:=clean||jsonb_build_object(k,v); END IF;
 END LOOP;
 IF coalesce(p_answers->>'contact_method','') IN ('Mobile','Email') THEN clean:=clean||jsonb_build_object('contact_method',p_answers->>'contact_method'); END IF;
 IF p_resume_path IS NOT NULL AND p_resume_path !~ ('^'||auth.uid()::text||'/[a-f0-9]{32}\.pdf$') THEN RAISE EXCEPTION 'Invalid resume upload'; END IF;
 INSERT INTO public.volunteer_applications(user_id,motivation,answers,resume_path) VALUES(auth.uid(),left(rpad(clean->>'why_join',10),2000),clean,p_resume_path)
 ON CONFLICT(user_id) DO UPDATE SET motivation=excluded.motivation,answers=excluded.answers,resume_path=coalesce(excluded.resume_path,public.volunteer_applications.resume_path),status='submitted',updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.list_volunteer_applications() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',a.user_id,'full_name',p.full_name,'motivation',a.motivation,'status',a.status,'answers',a.answers,'resume_path',a.resume_path,'updated_at',a.updated_at) ORDER BY a.updated_at)
  FROM public.volunteer_applications a JOIN public.profiles p ON p.id=a.user_id),'[]'::jsonb);
END $$;

-- Resumes: PDF only, written into the applicant's own folder, readable only by administrators (via signed URLs).
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('thabaat-volunteer-resumes','thabaat-volunteer-resumes',false,10485760,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS thabaat_resume_upload ON storage.objects;
CREATE POLICY thabaat_resume_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='thabaat-volunteer-resumes' AND name ~ ('^'||auth.uid()::text||'/[a-f0-9]{32}\.pdf$')
 AND (metadata->>'mimetype')='application/pdf' AND (metadata->>'size')::bigint BETWEEN 5 AND 10485760);
DROP POLICY IF EXISTS thabaat_resume_admin_read ON storage.objects;
CREATE POLICY thabaat_resume_admin_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='thabaat-volunteer-resumes' AND public.current_staff_role()='admin');

REVOKE ALL ON FUNCTION public.complete_my_profile(integer,text),public.reserve_free_tickets(uuid,jsonb,jsonb),public.check_in_party(uuid,text,uuid[]),
 public.set_event_social_question(uuid,boolean),public.submit_volunteer_interest(jsonb,text),public.list_volunteer_applications(),
 public.event_checkin_roster(uuid,text),public.check_in_registration(uuid,uuid),public.get_event_attendees(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_my_profile(integer,text),public.reserve_free_tickets(uuid,jsonb,jsonb),public.check_in_party(uuid,text,uuid[]),
 public.set_event_social_question(uuid,boolean),public.submit_volunteer_interest(jsonb,text),public.list_volunteer_applications(),
 public.event_checkin_roster(uuid,text),public.check_in_registration(uuid,uuid),public.get_event_attendees(uuid,integer),public.attendee_display_name(text,text,text) TO authenticated;
COMMIT;
