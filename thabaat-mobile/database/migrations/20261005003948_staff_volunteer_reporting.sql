-- Local migration, after events_permissions. Private staff records are exposed only through guarded RPCs.
BEGIN;
CREATE TABLE public.volunteer_applications (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 motivation text NOT NULL CHECK(length(motivation) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','declined')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.volunteer_assignments (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 duty text NOT NULL CHECK(length(duty) BETWEEN 3 AND 200),
 shift_start timestamptz NOT NULL, shift_end timestamptz NOT NULL,
 active boolean NOT NULL DEFAULT true, reviewed_hours numeric(5,2) NOT NULL DEFAULT 0 CHECK(reviewed_hours BETWEEN 0 AND 24),
 assigned_by uuid NOT NULL REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,user_id), CHECK(shift_end>shift_start AND shift_end<=shift_start+interval '24 hours')
);
CREATE TABLE public.volunteer_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 event_id uuid NOT NULL, user_id uuid NOT NULL, action text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX volunteer_assignments_user_idx ON public.volunteer_assignments(user_id,shift_start);
ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.volunteer_applications,public.volunteer_assignments,public.volunteer_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.volunteer_applications,public.volunteer_assignments,public.volunteer_audit TO service_role;
CREATE FUNCTION public.can_manage_staff_event(p_event_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.events e WHERE e.id=p_event_id AND (public.current_staff_role()='admin' OR (public.current_staff_role()='organizer' AND e.created_by=auth.uid())))
$$;
CREATE FUNCTION public.can_staff_event(p_event_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.can_manage_staff_event(p_event_id) OR (coalesce(public.current_staff_role()='volunteer',false) AND EXISTS(SELECT 1 FROM public.volunteer_assignments a JOIN public.events e ON e.id=a.event_id WHERE a.event_id=p_event_id AND a.user_id=auth.uid() AND a.active AND NOT e.archived AND now() BETWEEN a.shift_start-interval '30 minutes' AND a.shift_end)))
$$;
CREATE FUNCTION public.submit_volunteer_application(p_motivation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_motivation IS NULL OR length(trim(p_motivation)) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Describe your interests in 10 to 2000 characters'; END IF;
 INSERT INTO public.volunteer_applications(user_id,motivation) VALUES(auth.uid(),trim(p_motivation)) ON CONFLICT(user_id) DO UPDATE SET motivation=excluded.motivation,status='submitted',updated_at=now();
END $$;
CREATE FUNCTION public.my_volunteer_work() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT jsonb_build_object('application',(SELECT to_jsonb(a) - 'user_id' FROM public.volunteer_applications a WHERE a.user_id=auth.uid()),'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('event_id',a.event_id,'title',e.title,'duty',a.duty,'shift_start',a.shift_start,'shift_end',a.shift_end,'active',a.active,'reviewed_hours',a.reviewed_hours) ORDER BY a.shift_start) FROM public.volunteer_assignments a JOIN public.events e ON e.id=a.event_id WHERE a.user_id=auth.uid()),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.review_volunteer_application(p_user_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('approved','declined') THEN RAISE EXCEPTION 'Invalid application decision'; END IF;
 UPDATE public.volunteer_applications SET status=p_status,updated_at=now() WHERE user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
 -- Approval is an application decision only. Existing audited staff-role RPC remains authoritative.
END $$;
CREATE FUNCTION public.list_volunteer_applications() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',a.user_id,'full_name',p.full_name,'motivation',a.motivation,'status',a.status) ORDER BY a.updated_at) FROM public.volunteer_applications a JOIN public.profiles p ON p.id=a.user_id),'[]'::jsonb);
END $$;
CREATE FUNCTION public.set_volunteer_assignment(p_event_id uuid,p_user_id uuid,p_duty text,p_start timestamptz,p_end timestamptz,p_active boolean,p_hours numeric DEFAULT 0) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 PERFORM 1 FROM public.events WHERE id=p_event_id AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff_roles WHERE user_id=p_user_id AND role='volunteer') THEN RAISE EXCEPTION 'Select an account with the volunteer role'; END IF;
 IF p_duty IS NULL OR length(trim(p_duty)) NOT BETWEEN 3 AND 200 OR p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR p_end>p_start+interval '24 hours' OR p_active IS NULL OR p_hours IS NULL OR p_hours<0 OR p_hours>extract(epoch FROM p_end-p_start)/3600 THEN RAISE EXCEPTION 'Check duty, shift times and reviewed hours'; END IF;
 IF p_hours>0 AND p_end>now() THEN RAISE EXCEPTION 'Hours can only be reviewed after the shift'; END IF;
 INSERT INTO public.volunteer_assignments(event_id,user_id,duty,shift_start,shift_end,active,reviewed_hours,assigned_by) VALUES(p_event_id,p_user_id,trim(p_duty),p_start,p_end,p_active,p_hours,auth.uid()) ON CONFLICT(event_id,user_id) DO UPDATE SET duty=excluded.duty,shift_start=excluded.shift_start,shift_end=excluded.shift_end,active=excluded.active,reviewed_hours=excluded.reviewed_hours,assigned_by=auth.uid(),updated_at=now();
 INSERT INTO public.volunteer_audit(actor_id,event_id,user_id,action) VALUES(auth.uid(),p_event_id,p_user_id,CASE WHEN p_active THEN 'assignment_saved' ELSE 'assignment_revoked' END);
END $$;
CREATE FUNCTION public.staff_event_report(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN jsonb_build_object('event',(SELECT jsonb_build_object('title',e.title,'capacity',e.capacity,'event_date',e.event_date) FROM public.events e WHERE e.id=p_event_id),'volunteer_candidates',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.id,'full_name',p.full_name) ORDER BY p.full_name,p.id) FROM public.staff_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='volunteer'),'[]'::jsonb),'registrations',coalesce((SELECT jsonb_agg(jsonb_build_object('registration_id',r.id,'full_name',p.full_name,'ticket_name',t.name,'status',r.status,'registered_at',r.created_at) ORDER BY r.created_at,r.id) FROM public.registrations r JOIN public.profiles p ON p.id=r.user_id JOIN public.ticket_types t ON t.id=r.ticket_type_id WHERE r.event_id=p_event_id),'[]'::jsonb),'volunteers',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',a.user_id,'full_name',p.full_name,'duty',a.duty,'shift_start',a.shift_start,'shift_end',a.shift_end,'active',a.active,'reviewed_hours',a.reviewed_hours) ORDER BY a.shift_start,a.user_id) FROM public.volunteer_assignments a JOIN public.profiles p ON p.id=a.user_id WHERE a.event_id=p_event_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.can_manage_staff_event(uuid),public.can_staff_event(uuid),public.submit_volunteer_application(text),public.my_volunteer_work(),public.review_volunteer_application(uuid,text),public.list_volunteer_applications(),public.set_volunteer_assignment(uuid,uuid,text,timestamptz,timestamptz,boolean,numeric),public.staff_event_report(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_staff_event(uuid),public.submit_volunteer_application(text),public.my_volunteer_work(),public.review_volunteer_application(uuid,text),public.list_volunteer_applications(),public.set_volunteer_assignment(uuid,uuid,text,timestamptz,timestamptz,boolean,numeric),public.staff_event_report(uuid) TO authenticated;
COMMIT;
