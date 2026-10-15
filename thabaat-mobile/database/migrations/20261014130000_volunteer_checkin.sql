-- Phase 3 client feedback: check in by name, walk-ins, event volunteer sign-ups, volunteer leads.
-- Applied to the thabaat-staging development project on 2026-10-14 with the team's approval.
BEGIN;

-- Who may SEE an event's check-in list: event managers, or a volunteer with an active assignment to that
-- (non-archived) event. Checking people IN still uses can_staff_event, which also limits volunteers to their shift window.
CREATE OR REPLACE FUNCTION public.can_view_event_roster(p_event_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.can_manage_staff_event(p_event_id) OR (coalesce(public.current_staff_role()='volunteer',false) AND EXISTS(
  SELECT 1 FROM public.volunteer_assignments a JOIN public.events e ON e.id=a.event_id WHERE a.event_id=p_event_id AND a.user_id=auth.uid() AND a.active AND NOT e.archived)))
$$;

-- People who arrive without registering in the app. Kept apart from registrations, which require an account.
CREATE TABLE IF NOT EXISTS public.event_walk_ins(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
 contact text NOT NULL DEFAULT '' CHECK (length(contact)<=200),
 checked_in_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS event_walk_ins_event ON public.event_walk_ins(event_id);
ALTER TABLE public.event_walk_ins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_walk_ins FROM PUBLIC,anon,authenticated;

-- Check-in list for one event, optionally filtered by name. Names, ticket and check-in time only: no emails or contacts.
CREATE OR REPLACE FUNCTION public.event_checkin_roster(p_event_id uuid,p_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE needle text:='%'||replace(replace(replace(lower(trim(coalesce(p_search,''))),'\','\\'),'%','\%'),'_','\_')||'%';
BEGIN
 PERFORM public.assert_active_account();
 IF NOT public.can_view_event_roster(p_event_id) THEN RAISE EXCEPTION 'Event staff access required'; END IF;
 RETURN jsonb_build_object(
  'can_check_in',coalesce(public.can_staff_event(p_event_id),false),
  'capacity',(SELECT capacity FROM public.events WHERE id=p_event_id),
  'confirmed',(SELECT count(*) FROM public.registrations WHERE event_id=p_event_id AND status='confirmed'),
  'checked_in',(SELECT count(*) FROM public.event_checkins c JOIN public.registrations r ON r.id=c.registration_id WHERE c.event_id=p_event_id AND r.status='confirmed'),
  'walk_ins',(SELECT count(*) FROM public.event_walk_ins WHERE event_id=p_event_id),
  'people',coalesce((SELECT jsonb_agg(x ORDER BY lower(x->>'full_name'),x->>'id') FROM (
    SELECT jsonb_build_object('kind','registration','id',r.id,'full_name',p.full_name,'ticket_name',t.name,'checked_in_at',c.checked_in_at) x
     FROM public.registrations r JOIN public.profiles p ON p.id=r.user_id JOIN public.ticket_types t ON t.id=r.ticket_type_id LEFT JOIN public.event_checkins c ON c.registration_id=r.id
     WHERE r.event_id=p_event_id AND r.status='confirmed' AND lower(p.full_name) LIKE needle
    UNION ALL
    SELECT jsonb_build_object('kind','walk_in','id',w.id,'full_name',w.full_name,'ticket_name','Walk-in','checked_in_at',w.checked_in_at)
     FROM public.event_walk_ins w WHERE w.event_id=p_event_id AND lower(w.full_name) LIKE needle
    LIMIT 300) people),'[]'::jsonb));
END $$;

-- Check in a confirmed registration by tapping the person's name. Same rules as scanning their ticket QR:
-- staff on shift, inside the event window, active account, membership for members-only events. Repeats keep the first time.
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
 RETURN jsonb_build_object('registration_id',r.id,'full_name',(SELECT full_name FROM public.profiles WHERE id=r.user_id),'ticket_name',(SELECT name FROM public.ticket_types WHERE id=r.ticket_type_id),'checked_in_at',previous.checked_in_at,'already_checked_in',inserted_count=0);
END $$;

-- Add someone at the door who didn't register. They count against capacity and are checked in immediately.
CREATE OR REPLACE FUNCTION public.add_walk_in(p_event_id uuid,p_full_name text,p_contact text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; w public.event_walk_ins;
BEGIN
 PERFORM public.assert_active_account();
 IF NOT coalesce(public.can_staff_event(p_event_id),false) THEN RAISE EXCEPTION 'Active event staff assignment required'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR e.archived OR now()<e.event_date-interval '4 hours' OR now()>e.event_date+interval '24 hours' THEN RAISE EXCEPTION 'Walk-ins can be added during the event window'; END IF;
 IF length(trim(coalesce(p_full_name,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Enter the person''s name'; END IF;
 IF public.event_reserved_seats(p_event_id)+(SELECT count(*) FROM public.event_walk_ins WHERE event_id=p_event_id)>=e.capacity THEN RAISE EXCEPTION 'The event is full'; END IF;
 INSERT INTO public.event_walk_ins(event_id,full_name,contact,created_by) VALUES(p_event_id,trim(p_full_name),left(trim(coalesce(p_contact,'')),200),auth.uid()) RETURNING * INTO w;
 RETURN jsonb_build_object('id',w.id,'full_name',w.full_name,'checked_in_at',w.checked_in_at);
END $$;

-- Undo a walk-in added by mistake.
CREATE OR REPLACE FUNCTION public.remove_walk_in(p_walk_in_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.event_walk_ins;
BEGIN
 PERFORM public.assert_active_account();
 SELECT * INTO w FROM public.event_walk_ins WHERE id=p_walk_in_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Walk-in not found'; END IF;
 IF NOT coalesce(public.can_staff_event(w.event_id),false) THEN RAISE EXCEPTION 'Active event staff assignment required'; END IF;
 DELETE FROM public.event_walk_ins WHERE id=p_walk_in_id;
END $$;

-- Volunteer leads and a short description of each volunteer's role at an event.
ALTER TABLE public.volunteer_assignments ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false;
ALTER TABLE public.volunteer_assignments ADD COLUMN IF NOT EXISTS role_description text NOT NULL DEFAULT '' CHECK (length(role_description)<=500);

-- Event volunteer sign-ups. The answer fields are a placeholder until the client's volunteer form arrives.
CREATE TABLE IF NOT EXISTS public.event_volunteer_signups(
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 availability text NOT NULL DEFAULT '' CHECK (length(availability)<=200),
 preferred_role text NOT NULL DEFAULT '' CHECK (length(preferred_role)<=200),
 notes text NOT NULL DEFAULT '' CHECK (length(notes)<=1000),
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES public.profiles(id),
 PRIMARY KEY(event_id,user_id)
);
ALTER TABLE public.event_volunteer_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_volunteer_signups FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sign_up_to_volunteer(p_event_id uuid,p_availability text,p_preferred_role text,p_notes text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result text;
BEGIN
 PERFORM public.assert_active_account();
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND NOT archived AND event_date>now()) THEN RAISE EXCEPTION 'Volunteer sign-up is closed for this event'; END IF;
 INSERT INTO public.event_volunteer_signups(event_id,user_id,availability,preferred_role,notes) VALUES(p_event_id,auth.uid(),left(trim(coalesce(p_availability,'')),200),left(trim(coalesce(p_preferred_role,'')),200),left(trim(coalesce(p_notes,'')),1000))
 ON CONFLICT(event_id,user_id) DO UPDATE SET availability=excluded.availability,preferred_role=excluded.preferred_role,notes=excluded.notes,
  status=CASE WHEN public.event_volunteer_signups.status='confirmed' THEN 'confirmed' ELSE 'requested' END,updated_at=now()
 RETURNING status INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.my_volunteer_signups() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.assert_active_account();
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('event_id',s.event_id,'title',e.title,'event_date',e.event_date,'location',e.location,'status',s.status,'availability',s.availability,'preferred_role',s.preferred_role,'notes',s.notes) ORDER BY e.event_date)
  FROM public.event_volunteer_signups s JOIN public.events e ON e.id=s.event_id WHERE s.user_id=auth.uid() AND NOT e.archived),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.list_volunteer_signups(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.assert_active_account();
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',s.user_id,'full_name',p.full_name,'status',s.status,'availability',s.availability,'preferred_role',s.preferred_role,'notes',s.notes,'signed_up_at',s.created_at) ORDER BY s.status='cancelled',s.created_at)
  FROM public.event_volunteer_signups s JOIN public.profiles p ON p.id=s.user_id WHERE s.event_id=p_event_id),'[]'::jsonb);
END $$;

-- Shared by confirm_volunteer_signup and make_registrant_volunteer. Not callable directly.
-- Gives the person the volunteer role if they have no staff role (administrators only), then assigns them to the event.
CREATE OR REPLACE FUNCTION public.assign_event_volunteer(p_event_id uuid,p_user_id uuid,p_duty text,p_role_description text,p_is_lead boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; existing_role text; shift_end timestamptz;
BEGIN
 PERFORM public.assert_active_account();
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;
 IF NOT public.account_is_active(p_user_id) THEN RAISE EXCEPTION 'This account is suspended'; END IF;
 IF length(trim(coalesce(p_duty,''))) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Enter a role of 3 to 200 characters'; END IF;
 SELECT role INTO existing_role FROM public.staff_roles WHERE user_id=p_user_id;
 IF existing_role IS NULL THEN
  IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'An administrator must give this person the volunteer role first'; END IF;
  INSERT INTO public.staff_roles VALUES(p_user_id,'volunteer');
  INSERT INTO public.role_audit(actor_id,target_id,previous_role,new_role) VALUES(auth.uid(),p_user_id,NULL,'volunteer');
 END IF;
 shift_end:=least(coalesce(e.end_at,e.event_date+interval '3 hours'),e.event_date-interval '1 hour'+interval '24 hours');
 INSERT INTO public.volunteer_assignments(event_id,user_id,duty,shift_start,shift_end,active,reviewed_hours,assigned_by,is_lead,role_description)
  VALUES(p_event_id,p_user_id,trim(p_duty),e.event_date-interval '1 hour',shift_end,true,0,auth.uid(),coalesce(p_is_lead,false),left(trim(coalesce(p_role_description,'')),500))
 ON CONFLICT(event_id,user_id) DO UPDATE SET duty=excluded.duty,active=true,is_lead=excluded.is_lead,role_description=excluded.role_description,assigned_by=auth.uid(),updated_at=now();
 INSERT INTO public.event_volunteer_signups(event_id,user_id,status,reviewed_by) VALUES(p_event_id,p_user_id,'confirmed',auth.uid())
 ON CONFLICT(event_id,user_id) DO UPDATE SET status='confirmed',reviewed_by=auth.uid(),updated_at=now();
 INSERT INTO public.volunteer_audit(actor_id,event_id,user_id,action) VALUES(auth.uid(),p_event_id,p_user_id,'assignment_saved');
END $$;

CREATE OR REPLACE FUNCTION public.confirm_volunteer_signup(p_event_id uuid,p_user_id uuid,p_duty text,p_role_description text,p_is_lead boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.event_volunteer_signups WHERE event_id=p_event_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Volunteer sign-up not found'; END IF;
 PERFORM public.assign_event_volunteer(p_event_id,p_user_id,p_duty,p_role_description,p_is_lead);
END $$;

-- From the attendee list: turn someone who registered for this event into one of its volunteers.
CREATE OR REPLACE FUNCTION public.make_registrant_volunteer(p_event_id uuid,p_registration_id uuid,p_duty text,p_role_description text,p_is_lead boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 SELECT user_id INTO target FROM public.registrations WHERE id=p_registration_id AND event_id=p_event_id;
 IF target IS NULL THEN RAISE EXCEPTION 'Registration not found for this event'; END IF;
 PERFORM public.assign_event_volunteer(p_event_id,target,p_duty,p_role_description,p_is_lead);
END $$;

-- Update a volunteer's role at an event, or make them the lead.
CREATE OR REPLACE FUNCTION public.set_volunteer_role(p_event_id uuid,p_user_id uuid,p_duty text,p_role_description text,p_is_lead boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.assert_active_account();
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF length(trim(coalesce(p_duty,''))) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Enter a role of 3 to 200 characters'; END IF;
 UPDATE public.volunteer_assignments SET duty=trim(p_duty),role_description=left(trim(coalesce(p_role_description,'')),500),is_lead=coalesce(p_is_lead,false),assigned_by=auth.uid(),updated_at=now()
  WHERE event_id=p_event_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Volunteer is not assigned to this event'; END IF;
 INSERT INTO public.volunteer_audit(actor_id,event_id,user_id,action) VALUES(auth.uid(),p_event_id,p_user_id,'role_updated');
END $$;

-- Cancel a volunteer sign-up: volunteers cancel their own; event managers can cancel anyone's. Removes event duty access.
CREATE OR REPLACE FUNCTION public.cancel_volunteer_signup(p_event_id uuid,p_user_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid:=coalesce(p_user_id,auth.uid());
BEGIN
 PERFORM public.assert_active_account();
 IF target<>auth.uid() AND NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 UPDATE public.event_volunteer_signups SET status='cancelled',reviewed_by=CASE WHEN target=auth.uid() THEN reviewed_by ELSE auth.uid() END,updated_at=now() WHERE event_id=p_event_id AND user_id=target;
 UPDATE public.volunteer_assignments SET active=false,updated_at=now() WHERE event_id=p_event_id AND user_id=target AND active;
 IF FOUND THEN INSERT INTO public.volunteer_audit(actor_id,event_id,user_id,action) VALUES(auth.uid(),p_event_id,target,'assignment_revoked'); END IF;
END $$;

-- Same as before, plus is_lead and role_description on each volunteer.
CREATE OR REPLACE FUNCTION public.staff_event_report(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN jsonb_build_object('event',(SELECT jsonb_build_object('title',e.title,'capacity',e.capacity,'event_date',e.event_date) FROM public.events e WHERE e.id=p_event_id),
  'volunteer_candidates',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.id,'full_name',p.full_name) ORDER BY p.full_name,p.id) FROM public.staff_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='volunteer'),'[]'::jsonb),
  'registrations',coalesce((SELECT jsonb_agg(jsonb_build_object('registration_id',r.id,'full_name',p.full_name,'ticket_name',t.name,'status',r.status,'registered_at',r.created_at) ORDER BY r.created_at,r.id) FROM public.registrations r JOIN public.profiles p ON p.id=r.user_id JOIN public.ticket_types t ON t.id=r.ticket_type_id WHERE r.event_id=p_event_id),'[]'::jsonb),
  'volunteers',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',a.user_id,'full_name',p.full_name,'duty',a.duty,'shift_start',a.shift_start,'shift_end',a.shift_end,'active',a.active,'reviewed_hours',a.reviewed_hours,'is_lead',a.is_lead,'role_description',a.role_description) ORDER BY a.is_lead DESC,a.shift_start,a.user_id) FROM public.volunteer_assignments a JOIN public.profiles p ON p.id=a.user_id WHERE a.event_id=p_event_id),'[]'::jsonb));
END $$;

-- Same as before, plus is_lead, role_description and event date/location for the Team view.
CREATE OR REPLACE FUNCTION public.my_volunteer_work() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT jsonb_build_object('application',(SELECT to_jsonb(a) - 'user_id' FROM public.volunteer_applications a WHERE a.user_id=auth.uid()),
  'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('event_id',a.event_id,'title',e.title,'event_date',e.event_date,'location',e.location,'duty',a.duty,'shift_start',a.shift_start,'shift_end',a.shift_end,'active',a.active,'reviewed_hours',a.reviewed_hours,'is_lead',a.is_lead,'role_description',a.role_description) ORDER BY a.shift_start) FROM public.volunteer_assignments a JOIN public.events e ON e.id=a.event_id WHERE a.user_id=auth.uid()),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.can_view_event_roster(uuid),public.event_checkin_roster(uuid,text),public.check_in_registration(uuid,uuid),public.add_walk_in(uuid,text,text),public.remove_walk_in(uuid),
 public.sign_up_to_volunteer(uuid,text,text,text),public.my_volunteer_signups(),public.list_volunteer_signups(uuid),public.assign_event_volunteer(uuid,uuid,text,text,boolean),
 public.confirm_volunteer_signup(uuid,uuid,text,text,boolean),public.make_registrant_volunteer(uuid,uuid,text,text,boolean),public.set_volunteer_role(uuid,uuid,text,text,boolean),public.cancel_volunteer_signup(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_checkin_roster(uuid,text),public.check_in_registration(uuid,uuid),public.add_walk_in(uuid,text,text),public.remove_walk_in(uuid),
 public.sign_up_to_volunteer(uuid,text,text,text),public.my_volunteer_signups(),public.list_volunteer_signups(uuid),
 public.confirm_volunteer_signup(uuid,uuid,text,text,boolean),public.make_registrant_volunteer(uuid,uuid,text,text,boolean),public.set_volunteer_role(uuid,uuid,text,text,boolean),public.cancel_volunteer_signup(uuid,uuid) TO authenticated;
COMMIT;
