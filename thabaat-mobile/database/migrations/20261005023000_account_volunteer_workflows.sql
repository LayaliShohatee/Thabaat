-- LOCAL REVIEW ONLY. Application suspension does not revoke Auth sessions or service-role access.
BEGIN;
CREATE TABLE public.account_controls(user_id uuid PRIMARY KEY REFERENCES public.profiles(id),suspended boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.account_control_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES public.profiles(id),target_id uuid NOT NULL REFERENCES public.profiles(id),suspended boolean NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),revision integer NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.account_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_control_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_controls,public.account_control_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.account_controls,public.account_control_audit TO service_role;
CREATE FUNCTION public.account_is_active(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT p_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.account_controls WHERE user_id=p_user_id AND suspended) $$;
CREATE FUNCTION public.assert_active_account() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF; IF NOT public.account_is_active(auth.uid()) THEN RAISE EXCEPTION 'Account suspended. Contact Thabaat support for review.'; END IF; END $$;
CREATE OR REPLACE FUNCTION public.current_staff_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM public.staff_roles WHERE user_id=auth.uid() AND public.account_is_active(auth.uid()) $$;
CREATE FUNCTION public.admin_account_controls(p_search text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM public.assert_active_account(); IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_search IS NULL OR length(trim(p_search))<3 THEN RAISE EXCEPTION 'Enter at least three characters'; END IF;
 RETURN jsonb_build_object('accounts',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT p.id AS user_id,p.full_name,coalesce(c.suspended,false) AS suspended,coalesce(c.revision,0) AS revision,r.role AS staff_role FROM public.profiles p LEFT JOIN public.account_controls c ON c.user_id=p.id LEFT JOIN public.staff_roles r ON r.user_id=p.id WHERE p.full_name ILIKE '%'||trim(p_search)||'%' OR p.id::text=trim(p_search) ORDER BY p.full_name,p.id LIMIT 30)x),'[]'::jsonb),'history',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT a.* FROM public.account_control_audit a JOIN public.profiles p ON p.id=a.target_id WHERE p.full_name ILIKE '%'||trim(p_search)||'%' OR p.id::text=trim(p_search) ORDER BY a.recorded_at DESC LIMIT 100)x),'[]'::jsonb)); END $$;
CREATE FUNCTION public.set_account_suspension(p_user_id uuid,p_suspended boolean,p_reason text,p_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE c public.account_controls; BEGIN
 PERFORM public.assert_active_account(); IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.staff_roles WHERE user_id=p_user_id AND role='admin') THEN RAISE EXCEPTION 'Administrator accounts require a separate access review'; END IF;
 IF p_suspended IS NULL OR p_revision IS NULL OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'A reason of 10 to 1000 characters and current revision are required'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 INSERT INTO public.account_controls(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM public.account_controls WHERE user_id=p_user_id FOR UPDATE;
 IF c.revision<>p_revision THEN RAISE EXCEPTION 'Account changed; refresh before reviewing'; END IF;
 IF c.suspended=p_suspended THEN RETURN; END IF;
 UPDATE public.account_controls SET suspended=p_suspended,revision=revision+1,updated_at=now() WHERE user_id=p_user_id;
 INSERT INTO public.account_control_audit(actor_id,target_id,suspended,reason,revision) VALUES(auth.uid(),p_user_id,p_suspended,trim(p_reason),c.revision+1);
 END $$;
CREATE TABLE public.volunteer_onboarding_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES public.profiles(id),user_id uuid NOT NULL REFERENCES public.profiles(id),status text NOT NULL CHECK(status IN ('approved','declined')),recorded_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.volunteer_onboarding_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.volunteer_onboarding_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.volunteer_onboarding_audit TO service_role;
DO $$ DECLARE f record; body text; BEGIN SELECT prosrc,pg_get_functiondef(oid) AS definition INTO f FROM pg_proc WHERE oid='public.review_volunteer_application(uuid,text)'::regprocedure; body:=replace(f.prosrc,'-- Approval is an application decision only.', 'INSERT INTO public.volunteer_onboarding_audit(actor_id,user_id,status) VALUES(auth.uid(),p_user_id,p_status); -- Approval is an application decision only.'); EXECUTE replace(f.definition,f.prosrc,body); END $$;
CREATE TABLE public.volunteer_attendance(event_id uuid NOT NULL,user_id uuid NOT NULL,arrived_at timestamptz NOT NULL,departed_at timestamptz,PRIMARY KEY(event_id,user_id),FOREIGN KEY(event_id,user_id) REFERENCES public.volunteer_assignments(event_id,user_id),CHECK(departed_at IS NULL OR departed_at>=arrived_at));
ALTER TABLE public.volunteer_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.volunteer_attendance FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.volunteer_attendance TO service_role;
CREATE FUNCTION public.my_volunteer_attendance() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM public.assert_active_account(); RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('event_id',a.event_id,'title',e.title,'duty',a.duty,'shift_start',a.shift_start,'shift_end',a.shift_end,'active',a.active,'reviewed_hours',a.reviewed_hours,'arrived_at',v.arrived_at,'departed_at',v.departed_at) ORDER BY a.shift_start DESC) FROM public.volunteer_assignments a JOIN public.events e ON e.id=a.event_id LEFT JOIN public.volunteer_attendance v ON v.event_id=a.event_id AND v.user_id=a.user_id WHERE a.user_id=auth.uid()),'[]'::jsonb); END $$;
CREATE FUNCTION public.record_volunteer_attendance(p_event_id uuid,p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE a public.volunteer_assignments; v public.volunteer_attendance; BEGIN
 PERFORM public.assert_active_account(); IF public.current_staff_role() IS DISTINCT FROM 'volunteer' THEN RAISE EXCEPTION 'Volunteer role required'; END IF;
 SELECT * INTO a FROM public.volunteer_assignments WHERE event_id=p_event_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT a.active OR NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND NOT archived) THEN RAISE EXCEPTION 'Active assignment required'; END IF;
 SELECT * INTO v FROM public.volunteer_attendance WHERE event_id=p_event_id AND user_id=auth.uid();
 IF p_action='arrive' THEN
  IF v.arrived_at IS NOT NULL THEN RETURN to_jsonb(v); END IF;
  IF now()<a.shift_start-interval '30 minutes' OR now()>a.shift_end THEN RAISE EXCEPTION 'Arrival is only allowed within the assigned shift window'; END IF;
  INSERT INTO public.volunteer_attendance(event_id,user_id,arrived_at) VALUES(p_event_id,auth.uid(),now()) RETURNING * INTO v;
 ELSIF p_action='depart' THEN
  IF v.arrived_at IS NULL THEN RAISE EXCEPTION 'Record arrival first'; END IF;
  IF v.departed_at IS NOT NULL THEN RETURN to_jsonb(v); END IF;
  IF now()>a.shift_end+interval '30 minutes' THEN RAISE EXCEPTION 'Departure window ended; ask the event organizer to review attendance'; END IF;
  UPDATE public.volunteer_attendance SET departed_at=now() WHERE event_id=p_event_id AND user_id=auth.uid() RETURNING * INTO v;
 ELSE RAISE EXCEPTION 'Choose arrival or departure'; END IF;
 INSERT INTO public.volunteer_audit(actor_id,event_id,user_id,action) VALUES(auth.uid(),p_event_id,auth.uid(),'attendance_'||p_action);
 RETURN to_jsonb(v); END $$;
REVOKE ALL ON FUNCTION public.account_is_active(uuid),public.assert_active_account(),public.admin_account_controls(text),public.set_account_suspension(uuid,boolean,text,integer),public.my_volunteer_attendance(),public.record_volunteer_attendance(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_is_active(uuid),public.assert_active_account(),public.admin_account_controls(text),public.set_account_suspension(uuid,boolean,text,integer),public.my_volunteer_attendance(),public.record_volunteer_attendance(uuid,text) TO authenticated;
-- Revalidate the ticket owner even when active staff present a previously issued token.
DO $$ DECLARE f record; body text; BEGIN SELECT prosrc,pg_get_functiondef(oid) AS definition INTO f FROM pg_proc WHERE oid='public.check_in_ticket(uuid,text)'::regprocedure; body:=replace(f.prosrc,'IF NOT FOUND OR r.status<>''confirmed'' THEN','IF NOT FOUND OR r.status<>''confirmed'' OR NOT public.account_is_active(r.user_id) THEN'); EXECUTE replace(f.definition,f.prosrc,body); END $$;
-- Media private capability cannot return access for a suspended caller.
DO $$ DECLARE f record; body text; BEGIN SELECT prosrc,pg_get_functiondef(oid) AS definition INTO f FROM pg_proc WHERE oid='private.media_access(uuid)'::regprocedure; body:=replace(f.prosrc,'auth.uid() IS NOT NULL AND','auth.uid() IS NOT NULL AND public.account_is_active(auth.uid()) AND'); EXECUTE replace(f.definition,f.prosrc,body); END $$;
-- Private playlist ownership cannot bypass suspension through a capability helper.
DO $$ DECLARE f record; body text; BEGIN SELECT prosrc,pg_get_functiondef(oid) AS definition INTO f FROM pg_proc WHERE oid='private.owns_media_playlist(uuid)'::regprocedure; body:=replace(f.prosrc,'SELECT EXISTS','SELECT public.account_is_active(auth.uid()) AND EXISTS'); EXECUTE replace(f.definition,f.prosrc,body); END $$;
-- A previously offered ticket cannot bypass either participant's suspension.
DO $$ DECLARE f record; body text; BEGIN
 SELECT prosrc,pg_get_functiondef(oid) AS definition INTO f FROM pg_proc WHERE oid='public.begin_free_ticket_gift(uuid,uuid,uuid)'::regprocedure;
 body:=replace(f.prosrc,'IF p_request_id IS NULL OR','IF NOT public.account_is_active(p_recipient_id) OR p_request_id IS NULL OR'); EXECUTE replace(f.definition,f.prosrc,body);
 SELECT prosrc,pg_get_functiondef(oid) AS definition INTO f FROM pg_proc WHERE oid='public.accept_free_ticket_gift(uuid)'::regprocedure;
 body:=replace(f.prosrc,'IF NOT FOUND OR sender.status','IF NOT FOUND OR NOT public.account_is_active(g.sender_id) OR sender.status'); EXECUTE replace(f.definition,f.prosrc,body);
END $$;
-- Fail closed for existing authenticated application RPCs, preserving signatures/ACLs.
DO $$ DECLARE f record; body text; BEGIN
 FOR f IN SELECT p.oid,p.prosrc,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND l.lanname='plpgsql' AND p.prosecdef AND p.prorettype<>'trigger'::regtype AND has_function_privilege('authenticated',p.oid,'EXECUTE') AND p.proname NOT IN ('assert_active_account') LOOP
  IF position('public.assert_active_account()' IN f.prosrc)=0 THEN
   body:=regexp_replace(f.prosrc,'\mBEGIN\M','BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;','i');
   IF body=f.prosrc THEN RAISE EXCEPTION 'Could not guard application RPC %',f.oid::regprocedure; END IF;
   EXECUTE replace(f.definition,f.prosrc,body);
  END IF;
 END LOOP;
END $$;
-- Restrictive policies intersect existing authenticated policies; service-role processing remains unchanged.
DO $$ DECLARE t record; BEGIN FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage') AND c.relkind='r' AND c.relrowsecurity LOOP EXECUTE format('CREATE POLICY account_active_guard ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.account_is_active(auth.uid())) WITH CHECK (public.account_is_active(auth.uid()))',t.nspname,t.relname); END LOOP; END $$;
COMMIT;
