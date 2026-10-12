-- Backlog completion (October 12): in-app membership changes (#53–55), plan/tier management (#136),
-- reviewed public event pages (#117/#118, from proposals/public_event_preview.sql), volunteer shift reminders (#139)
-- and volunteer onboarding (#141).
-- Apply only after explicit approval. The anonymous grant on reviewed_public_event(s) needs the stakeholder's
-- public-visibility approval; requires 20261005005702_membership_administration and 20261005004111_notification_preferences_outbox.
BEGIN;

-- #53–55 Members request renewal cancellation, resumption or a plan change in the app; an administrator
-- completes it in CharityStack and confirms here, which updates the membership record.
CREATE TABLE IF NOT EXISTS public.membership_change_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('cancel_renewal','resume_renewal','change_plan')),
 target_plan_id uuid REFERENCES public.membership_plans(id),
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','completed','declined')),
 requested_at timestamptz NOT NULL DEFAULT now(), reviewed_by uuid, reviewed_at timestamptz,
 CHECK ((kind='change_plan')=(target_plan_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS membership_change_one_open ON public.membership_change_requests(user_id) WHERE status='requested';
ALTER TABLE public.membership_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_change_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.membership_change_requests TO authenticated;
DROP POLICY IF EXISTS thabaat_membership_change_own ON public.membership_change_requests;
CREATE POLICY thabaat_membership_change_own ON public.membership_change_requests FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.request_membership_change(p_kind text,p_target_plan_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.memberships; result_id uuid;
BEGIN
 IF pg_catalog.to_regprocedure('public.assert_active_account()') IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO m FROM public.memberships WHERE user_id=auth.uid();
 IF NOT FOUND OR m.status NOT IN ('active','past_due') THEN RAISE EXCEPTION 'An active membership is required'; END IF;
 IF m.source='complimentary' THEN RAISE EXCEPTION 'Complimentary memberships are managed by staff'; END IF;
 IF p_kind='cancel_renewal' AND m.cancel_at_period_end THEN RAISE EXCEPTION 'Renewal is already set to stop'; END IF;
 IF p_kind='resume_renewal' AND NOT m.cancel_at_period_end THEN RAISE EXCEPTION 'Your membership is already renewing'; END IF;
 IF p_kind='change_plan' AND (p_target_plan_id IS NULL OR p_target_plan_id=m.plan_id OR NOT EXISTS(SELECT 1 FROM public.membership_plans WHERE id=p_target_plan_id AND published)) THEN RAISE EXCEPTION 'Choose a different published plan'; END IF;
 IF EXISTS(SELECT 1 FROM public.membership_change_requests WHERE user_id=auth.uid() AND status='requested') THEN RAISE EXCEPTION 'You already have a membership change in progress'; END IF;
 INSERT INTO public.membership_change_requests(user_id,kind,target_plan_id) VALUES(auth.uid(),p_kind,CASE WHEN p_kind='change_plan' THEN p_target_plan_id END) RETURNING id INTO result_id;
 RETURN result_id;
END $$;
CREATE OR REPLACE FUNCTION public.review_membership_change(p_request_id uuid,p_complete boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.membership_change_requests;
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 SELECT * INTO q FROM public.membership_change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR q.status<>'requested' THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
 UPDATE public.membership_change_requests SET status=CASE WHEN p_complete THEN 'completed' ELSE 'declined' END,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=q.id;
 IF p_complete THEN
  IF q.kind='cancel_renewal' THEN UPDATE public.memberships SET cancel_at_period_end=true WHERE user_id=q.user_id;
  ELSIF q.kind='resume_renewal' THEN UPDATE public.memberships SET cancel_at_period_end=false WHERE user_id=q.user_id;
  ELSE UPDATE public.memberships SET plan_id=q.target_plan_id WHERE user_id=q.user_id; END IF;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.list_membership_change_requests() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'full_name',p.full_name,'kind',q.kind,'current_plan',cp.name,'target_plan',tp.name,'status',q.status,'requested_at',q.requested_at) ORDER BY q.status<>'requested',q.requested_at DESC)
  FROM public.membership_change_requests q JOIN public.profiles p ON p.id=q.user_id LEFT JOIN public.memberships m ON m.user_id=q.user_id LEFT JOIN public.membership_plans cp ON cp.id=m.plan_id LEFT JOIN public.membership_plans tp ON tp.id=q.target_plan_id),'[]'::jsonb);
END $$;

-- #136 Tier management: administrators create and edit membership plans, including the member ticket discount.
CREATE OR REPLACE FUNCTION public.save_membership_plan(p_id uuid,p_name text,p_description text,p_benefits text[],p_amount_cents integer,p_billing_period text,p_checkout_url text,p_published boolean,p_ticket_discount_percent integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result_id uuid;
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Enter a plan name (2–80 characters)'; END IF;
 IF p_checkout_url IS NOT NULL AND p_checkout_url !~ '^https://' THEN RAISE EXCEPTION 'Checkout link must start with https://'; END IF;
 IF coalesce(p_ticket_discount_percent,0) NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Ticket discount must be 0–100 percent'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.membership_plans(name,description,benefits,amount_cents,billing_period,checkout_url,published,ticket_discount_percent)
  VALUES(trim(p_name),coalesce(p_description,''),coalesce(p_benefits,'{}'),p_amount_cents,p_billing_period,p_checkout_url,coalesce(p_published,false),coalesce(p_ticket_discount_percent,0)) RETURNING id INTO result_id;
 ELSE
  UPDATE public.membership_plans SET name=trim(p_name),description=coalesce(p_description,''),benefits=coalesce(p_benefits,'{}'),amount_cents=p_amount_cents,billing_period=p_billing_period,checkout_url=p_checkout_url,published=coalesce(p_published,false),ticket_discount_percent=coalesce(p_ticket_discount_percent,0),revision=revision+1
  WHERE id=p_id AND acquisition_mode='charitystack' RETURNING id INTO result_id;
  IF result_id IS NULL THEN RAISE EXCEPTION 'Plan not found (complimentary plans are fixed)'; END IF;
 END IF;
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.request_membership_change(text,uuid),public.review_membership_change(uuid,boolean),public.list_membership_change_requests(),public.save_membership_plan(uuid,text,text,text[],integer,text,text,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_membership_change(text,uuid),public.review_membership_change(uuid,boolean),public.list_membership_change_requests(),public.save_membership_plan(uuid,text,text,text[],integer,text,text,boolean,integer) TO authenticated;

-- #117/#118 Reviewed public event pages (adopted from proposals/public_event_preview.sql). Only events an
-- administrator explicitly publishes are visible without signing in, and only their reviewed fields.
CREATE SCHEMA IF NOT EXISTS thabaat_public_preview;
REVOKE ALL ON SCHEMA thabaat_public_preview FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS thabaat_public_preview.publications (
 event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
 public_title text NOT NULL CHECK(length(trim(public_title)) BETWEEN 3 AND 150),
 public_summary text NOT NULL CHECK(length(public_summary)<=1000),
 venue_label text NOT NULL CHECK(length(trim(venue_label)) BETWEEN 2 AND 150),
 visible boolean NOT NULL DEFAULT false,
 approved_by uuid NOT NULL REFERENCES public.profiles(id), approved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thabaat_public_preview.publications ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS thabaat_public_preview.audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL,actor_id uuid NOT NULL,visible boolean NOT NULL,changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thabaat_public_preview.audit ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reviewed_public_event(p_id uuid)
RETURNS TABLE(event_id uuid,title text,summary text,event_date timestamptz,venue text,image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.event_id,p.public_title,p.public_summary,e.event_date,p.venue_label,e.image_url
 FROM thabaat_public_preview.publications p JOIN public.events e ON e.id=p.event_id
 WHERE p.event_id=p_id AND p.visible AND NOT e.archived AND NOT e.members_only
$$;
CREATE OR REPLACE FUNCTION public.reviewed_public_events()
RETURNS TABLE(event_id uuid,title text,summary text,event_date timestamptz,venue text,image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.event_id,p.public_title,p.public_summary,e.event_date,p.venue_label,e.image_url
 FROM thabaat_public_preview.publications p JOIN public.events e ON e.id=p.event_id
 WHERE p.visible AND NOT e.archived AND NOT e.members_only AND e.event_date>now() ORDER BY e.event_date LIMIT 100
$$;
CREATE OR REPLACE FUNCTION public.set_reviewed_public_event(p_id uuid,p_title text,p_summary text,p_venue text,p_visible boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_id AND NOT archived AND NOT members_only) THEN RAISE EXCEPTION 'Only a non-archived non-member event may be published publicly'; END IF;
 INSERT INTO thabaat_public_preview.publications(event_id,public_title,public_summary,venue_label,visible,approved_by)
 VALUES(p_id,trim(p_title),coalesce(p_summary,''),trim(p_venue),p_visible,auth.uid())
 ON CONFLICT(event_id) DO UPDATE SET public_title=excluded.public_title,public_summary=excluded.public_summary,venue_label=excluded.venue_label,visible=excluded.visible,approved_by=excluded.approved_by,approved_at=now();
 INSERT INTO thabaat_public_preview.audit(event_id,actor_id,visible) VALUES(p_id,auth.uid(),p_visible);
END $$;
REVOKE ALL ON FUNCTION public.reviewed_public_event(uuid),public.reviewed_public_events(),public.set_reviewed_public_event(uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reviewed_public_event(uuid),public.reviewed_public_events() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_reviewed_public_event(uuid,text,text,text,boolean) TO authenticated;

-- #139 Volunteer shift reminders through the existing notification outbox (24 hours before each active shift).
ALTER TABLE thabaat_notifications.outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE thabaat_notifications.outbox ADD CONSTRAINT outbox_kind_check CHECK (kind IN ('confirmation','week','day','morning','starting','membership_expiry','video','announcement','volunteer_shift'));
CREATE OR REPLACE FUNCTION public.schedule_volunteer_shift_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer;
BEGIN
 INSERT INTO thabaat_notifications.outbox(user_id,event_id,kind,dedupe_key,available_at,payload)
 SELECT a.user_id,a.event_id,'volunteer_shift','volunteer_shift:'||a.event_id||':'||a.user_id||':'||extract(epoch FROM a.shift_start)::bigint,greatest(now(),a.shift_start-interval '24 hours'),
  jsonb_build_object('title','Volunteer shift reminder','body',left(e.title,80)||': '||a.duty||' starts '||to_char(a.shift_start AT TIME ZONE coalesce(nullif(to_jsonb(e)->>'timezone',''),'UTC'),'Dy Mon DD HH12:MI AM'))
 FROM public.volunteer_assignments a JOIN public.events e ON e.id=a.event_id
 WHERE a.active AND NOT e.archived AND a.shift_start>now() AND a.shift_start<=now()+interval '48 hours'
 ON CONFLICT (dedupe_key) DO NOTHING;
 GET DIAGNOSTICS total=ROW_COUNT;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.schedule_volunteer_shift_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_volunteer_shift_reminders() TO service_role;

-- #141 Volunteer onboarding checklist completed after an application is approved.
CREATE TABLE IF NOT EXISTS public.volunteer_onboarding(
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 acknowledged text[] NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.volunteer_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.volunteer_onboarding FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.complete_volunteer_onboarding(p_acknowledged text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.volunteer_applications WHERE user_id=auth.uid() AND status='approved') THEN RAISE EXCEPTION 'Onboarding opens after your volunteer application is approved'; END IF;
 IF p_acknowledged IS NULL OR NOT (p_acknowledged @> ARRAY['code_of_conduct','safety','check_in','contact']) THEN RAISE EXCEPTION 'Please confirm every onboarding step'; END IF;
 INSERT INTO public.volunteer_onboarding(user_id,acknowledged) VALUES(auth.uid(),p_acknowledged) ON CONFLICT (user_id) DO UPDATE SET acknowledged=excluded.acknowledged,completed_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.my_volunteer_onboarding() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('approved',EXISTS(SELECT 1 FROM public.volunteer_applications WHERE user_id=auth.uid() AND status='approved'),'completed_at',(SELECT completed_at FROM public.volunteer_onboarding WHERE user_id=auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.complete_volunteer_onboarding(text[]),public.my_volunteer_onboarding() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_volunteer_onboarding(text[]),public.my_volunteer_onboarding() TO authenticated;

COMMIT;
