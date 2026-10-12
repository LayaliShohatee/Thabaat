-- Local migration only. Apply in approved staging after verification.
BEGIN;
CREATE TABLE IF NOT EXISTS public.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 push_enabled boolean NOT NULL DEFAULT false,
 confirmations boolean NOT NULL DEFAULT false,
 membership_alerts boolean NOT NULL DEFAULT false,
 video_alerts boolean NOT NULL DEFAULT false,
 reminders text[] NOT NULL DEFAULT '{}', categories text[] NOT NULL DEFAULT '{}',
 CHECK (reminders <@ ARRAY['week','day','morning','starting']::text[]),
 CHECK (categories <@ ARRAY['men','women','young_professionals','volunteer','conferences']::text[])
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_self ON public.notification_preferences;
CREATE POLICY notification_preferences_self ON public.notification_preferences FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.notification_preferences FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
CREATE SCHEMA IF NOT EXISTS thabaat_notifications;
REVOKE ALL ON SCHEMA thabaat_notifications FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA thabaat_notifications TO service_role;
CREATE TABLE IF NOT EXISTS thabaat_notifications.outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 registration_id uuid REFERENCES public.registrations(id) ON DELETE CASCADE,
 event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('confirmation','week','day','morning','starting','membership_expiry','video','announcement')),
 dedupe_key text NOT NULL UNIQUE,
 available_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','suppressed','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz
);
ALTER TABLE thabaat_notifications.outbox ENABLE ROW LEVEL SECURITY;
GRANT ALL ON thabaat_notifications.outbox TO service_role;
CREATE INDEX IF NOT EXISTS notification_outbox_due ON thabaat_notifications.outbox(available_at) WHERE status='pending';
ALTER TABLE thabaat_notifications.outbox ADD COLUMN IF NOT EXISTS source_event_date timestamptz;
ALTER TABLE thabaat_notifications.outbox ADD COLUMN IF NOT EXISTS source_membership_expiry timestamptz;
-- Service scheduler only. No client can broadcast or fabricate a membership alert.
-- Venue-local morning needs an event timezone field: intentionally not guessed here.
CREATE OR REPLACE FUNCTION thabaat_notifications.schedule_due_notifications() RETURNS integer
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
 DECLARE total integer := 0; count_added integer;
 BEGIN
 INSERT INTO thabaat_notifications.outbox(user_id,registration_id,event_id,kind,dedupe_key,available_at,source_event_date)
 SELECT r.user_id,r.id,e.id,c.kind,'reminder:'||r.id||':'||e.event_date||':'||c.kind,e.event_date-c.offset_interval,e.event_date
 FROM public.registrations r JOIN public.events e ON e.id=r.event_id
 JOIN public.notification_preferences p ON p.user_id=r.user_id
 CROSS JOIN (VALUES ('week',interval '7 days'),('day',interval '24 hours'),('starting',interval '0 hours')) c(kind,offset_interval)
 WHERE r.status='confirmed' AND p.push_enabled AND c.kind=ANY(p.reminders)
 AND e.event_date-c.offset_interval > now()
 ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS count_added=ROW_COUNT; total:=total+count_added;
 INSERT INTO thabaat_notifications.outbox(user_id,kind,dedupe_key,available_at,source_membership_expiry)
 SELECT m.user_id,'membership_expiry','membership_expiry:'||m.id||':'||m.expires_at,m.expires_at-interval '7 days',m.expires_at
 FROM public.memberships m JOIN public.notification_preferences p ON p.user_id=m.user_id
 WHERE m.status='active' AND m.expires_at>now() AND p.push_enabled AND p.membership_alerts
 ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS count_added=ROW_COUNT; RETURN total+count_added;
 END $$;
REVOKE ALL ON FUNCTION thabaat_notifications.schedule_due_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION thabaat_notifications.schedule_due_notifications() TO service_role;
ALTER TABLE thabaat_notifications.outbox ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}';
ALTER TABLE thabaat_notifications.outbox ADD COLUMN IF NOT EXISTS source_event_date timestamptz;
ALTER TABLE thabaat_notifications.outbox ADD COLUMN IF NOT EXISTS source_membership_expiry timestamptz;
ALTER TABLE thabaat_notifications.outbox DROP CONSTRAINT IF EXISTS outbox_status_check;
ALTER TABLE thabaat_notifications.outbox ADD CONSTRAINT outbox_status_check CHECK(status IN ('pending','dispatching','accepted','suppressed','failed','uncertain'));

CREATE OR REPLACE FUNCTION thabaat_notifications.enqueue_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.action IN ('registered','reactivated') THEN
 INSERT INTO thabaat_notifications.outbox(user_id,registration_id,event_id,kind,dedupe_key)
 SELECT NEW.user_id,NEW.registration_id,NEW.event_id,'confirmation','confirmation:'||NEW.id
 FROM public.notification_preferences p WHERE p.user_id=NEW.user_id AND p.push_enabled AND p.confirmations
 ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION thabaat_notifications.enqueue_confirmation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notification_confirmation_history ON public.registration_history;
CREATE TRIGGER notification_confirmation_history AFTER INSERT ON public.registration_history
FOR EACH ROW EXECUTE FUNCTION thabaat_notifications.enqueue_confirmation();

GRANT SELECT ON public.staff_roles,public.volunteer_assignments,public.registration_history,public.registrations,public.events,public.memberships,public.profiles TO service_role;
CREATE OR REPLACE FUNCTION public.claim_registration_confirmation(p_user_id uuid,p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job thabaat_notifications.outbox; history_id uuid;
BEGIN
 SELECT h.id INTO history_id FROM public.registration_history h JOIN public.registrations r ON r.id=h.registration_id
 WHERE h.user_id=p_user_id AND h.event_id=p_event_id AND h.action IN ('registered','reactivated') AND r.status='confirmed' AND EXISTS(SELECT 1 FROM public.events e WHERE e.id=r.event_id AND NOT e.archived AND e.event_date>now())
 ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF history_id IS NULL THEN RETURN jsonb_build_object('status','suppressed'); END IF;
 SELECT * INTO job FROM thabaat_notifications.outbox WHERE dedupe_key='confirmation:'||history_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','suppressed'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.notification_preferences WHERE user_id=p_user_id AND push_enabled AND confirmations) THEN
  UPDATE thabaat_notifications.outbox SET status='suppressed' WHERE id=job.id;
  RETURN jsonb_build_object('status','suppressed');
 END IF;
 IF job.status NOT IN ('pending','failed') OR job.attempts>=3 OR job.available_at>now() THEN RETURN jsonb_build_object('status',job.status); END IF;
 UPDATE thabaat_notifications.outbox SET status='dispatching',attempts=attempts+1 WHERE id=job.id;
 RETURN jsonb_build_object('status','claimed','id',job.id);
END $$;
REVOKE ALL ON FUNCTION public.claim_registration_confirmation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_confirmation(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_notification_job(p_id uuid,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_status NOT IN ('accepted','failed','uncertain','suppressed') THEN RAISE EXCEPTION 'Invalid delivery outcome'; END IF;
 UPDATE thabaat_notifications.outbox SET status=p_status,available_at=CASE WHEN p_status='failed' THEN now()+interval '1 minute'*power(2,attempts) ELSE available_at END,accepted_at=CASE WHEN p_status='accepted' THEN now() ELSE NULL END
 WHERE id=p_id AND status='dispatching';
END $$;
REVOKE ALL ON FUNCTION public.complete_notification_job(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_notification_job(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION thabaat_notifications.video_is_published(p_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT false $$;
REVOKE ALL ON FUNCTION thabaat_notifications.video_is_published(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION thabaat_notifications.video_is_published(text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_due_notification_jobs(p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job thabaat_notifications.outbox; p public.notification_preferences; e public.events; allowed boolean; result jsonb:='[]'; token text;
BEGIN
 FOR job IN SELECT * FROM thabaat_notifications.outbox WHERE status IN ('pending','failed') AND available_at<=now() AND attempts<3 ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),100)
 LOOP
 SELECT * INTO p FROM public.notification_preferences WHERE user_id=job.user_id;
 allowed:=FOUND AND p.push_enabled;
 IF job.event_id IS NOT NULL THEN
  SELECT * INTO e FROM public.events WHERE id=job.event_id;
  allowed:=allowed AND FOUND AND NOT e.archived;
 END IF;
 IF job.kind='confirmation' THEN
  allowed:=allowed AND p.confirmations AND e.event_date>now() AND EXISTS(SELECT 1 FROM public.registrations r JOIN public.registration_history h ON h.registration_id=r.id WHERE r.id=job.registration_id AND r.status='confirmed' AND job.dedupe_key='confirmation:'||h.id AND h.id=(SELECT h2.id FROM public.registration_history h2 WHERE h2.registration_id=r.id AND h2.action IN ('registered','reactivated') ORDER BY h2.created_at DESC,h2.id DESC LIMIT 1));
 ELSIF job.kind IN ('week','day','morning','starting') THEN
  allowed:=allowed AND job.kind=ANY(p.reminders) AND e.event_date=job.source_event_date AND (job.kind<>'morning' OR job.payload->>'timezone'=to_jsonb(e)->>'timezone')
   AND job.available_at>=now()-interval '1 hour' AND (job.kind='starting' OR e.event_date>now())
   AND EXISTS(SELECT 1 FROM public.registrations WHERE id=job.registration_id AND status='confirmed');
 ELSIF job.kind='membership_expiry' THEN
  allowed:=allowed AND p.membership_alerts AND EXISTS(SELECT 1 FROM public.memberships WHERE user_id=job.user_id AND status='active' AND starts_at<=now() AND verified_at<=now() AND expires_at>now() AND expires_at=job.source_membership_expiry);
 ELSIF job.kind='video' THEN
  allowed:=allowed AND thabaat_notifications.video_is_published(job.payload->>'mediaId') AND p.video_alerts AND EXISTS(SELECT 1 FROM public.memberships WHERE user_id=job.user_id AND status='active' AND starts_at<=now() AND verified_at<=now() AND expires_at>now());
 ELSIF job.kind='announcement' THEN
  allowed:=allowed AND (job.payload->>'category')=ANY(p.categories) AND EXISTS(SELECT 1 FROM thabaat_notifications.broadcasts b JOIN public.staff_roles sr ON sr.user_id=b.actor_id AND sr.role='admin' WHERE b.id::text=job.payload->>'broadcastId');
  IF coalesce((job.payload->>'members_only')::boolean,false) THEN
   allowed:=allowed AND EXISTS(SELECT 1 FROM public.memberships WHERE user_id=job.user_id AND status='active' AND starts_at<=now() AND verified_at<=now() AND expires_at>now());
  END IF;
  IF job.event_id IS NOT NULL THEN
   IF coalesce((job.payload->>'volunteer_only')::boolean,false) THEN
    allowed:=allowed AND EXISTS(SELECT 1 FROM public.volunteer_assignments WHERE user_id=job.user_id AND event_id=job.event_id AND active);
   ELSE allowed:=allowed AND EXISTS(SELECT 1 FROM public.registrations WHERE user_id=job.user_id AND event_id=job.event_id AND status='confirmed'); END IF;
  END IF;
 END IF;
 SELECT expo_push_token INTO token FROM public.profiles WHERE id=job.user_id;
 IF NOT coalesce(allowed,false) THEN
  UPDATE thabaat_notifications.outbox SET status='suppressed' WHERE id=job.id;
 ELSIF token IS NOT NULL AND token<>'' THEN
  UPDATE thabaat_notifications.outbox SET status='dispatching',attempts=attempts+1 WHERE id=job.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',job.id,'kind',job.kind,'token',token,'eventId',job.event_id,'title',coalesce(job.payload->>'title',CASE WHEN job.kind='membership_expiry' THEN 'Membership ending soon' WHEN job.kind='confirmation' THEN 'Registration Confirmed' ELSE 'Event reminder' END),'body',coalesce(job.payload->>'body',CASE WHEN job.kind='membership_expiry' THEN 'Review your membership end date in the app.' ELSE e.title END)));
 END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.claim_due_notification_jobs(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_notification_jobs(integer) TO service_role;

CREATE TABLE IF NOT EXISTS thabaat_notifications.broadcasts (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.profiles(id),category text NOT NULL,event_id uuid REFERENCES public.events(id),members_only boolean NOT NULL,volunteer_only boolean NOT NULL DEFAULT false,
 title text NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thabaat_notifications.broadcasts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON thabaat_notifications.broadcasts TO service_role;
CREATE OR REPLACE FUNCTION public.review_notification_broadcast(p_category text,p_event_id uuid DEFAULT NULL,p_members_only boolean DEFAULT false,p_volunteer_only boolean DEFAULT false) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer;
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_category IS NULL OR p_category NOT IN ('men','women','young_professionals','volunteer','conferences') THEN RAISE EXCEPTION 'Choose an approved announcement category'; END IF;
 IF p_volunteer_only AND p_event_id IS NULL THEN RAISE EXCEPTION 'Choose an event for assigned-volunteer targeting'; END IF;
 IF p_event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND NOT archived) THEN RAISE EXCEPTION 'Event unavailable'; END IF;
 SELECT count(*) INTO total FROM public.notification_preferences p WHERE p.push_enabled AND p_category=ANY(p.categories)
 AND (p_event_id IS NULL OR (NOT p_volunteer_only AND EXISTS(SELECT 1 FROM public.registrations WHERE user_id=p.user_id AND event_id=p_event_id AND status='confirmed')) OR (p_volunteer_only AND EXISTS(SELECT 1 FROM public.volunteer_assignments WHERE user_id=p.user_id AND event_id=p_event_id AND active)))
 AND (NOT p_members_only OR EXISTS(SELECT 1 FROM public.memberships WHERE user_id=p.user_id AND status='active' AND starts_at<=now() AND verified_at<=now() AND expires_at>now()));
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.review_notification_broadcast(text,uuid,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_notification_broadcast(text,uuid,boolean,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.queue_notification_broadcast(p_id uuid,p_category text,p_event_id uuid,p_members_only boolean,p_title text,p_body text,p_volunteer_only boolean DEFAULT false) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing thabaat_notifications.broadcasts; total integer;
BEGIN
 PERFORM public.review_notification_broadcast(p_category,p_event_id,p_members_only,p_volunteer_only);
 IF p_id IS NULL OR p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 3 AND 100 OR p_body IS NULL OR length(trim(p_body)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Enter a title and message within allowed length'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_id::text));
 SELECT * INTO existing FROM thabaat_notifications.broadcasts WHERE id=p_id;
 IF FOUND THEN
  IF existing.actor_id<>auth.uid() OR existing.category<>p_category OR existing.event_id IS DISTINCT FROM p_event_id OR existing.members_only IS DISTINCT FROM p_members_only OR existing.volunteer_only IS DISTINCT FROM p_volunteer_only OR existing.title<>trim(p_title) OR existing.body<>trim(p_body) THEN RAISE EXCEPTION 'Broadcast request identifier was already used'; END IF;
  SELECT count(*) INTO total FROM thabaat_notifications.outbox WHERE dedupe_key LIKE 'broadcast:'||p_id||':%'; RETURN total;
 END IF;
 INSERT INTO thabaat_notifications.broadcasts VALUES(p_id,auth.uid(),p_category,p_event_id,p_members_only,p_volunteer_only,trim(p_title),trim(p_body),now());
 INSERT INTO thabaat_notifications.outbox(user_id,event_id,kind,dedupe_key,payload)
 SELECT p.user_id,p_event_id,'announcement','broadcast:'||p_id||':'||p.user_id,jsonb_build_object('title',trim(p_title),'body',trim(p_body),'category',p_category,'members_only',p_members_only,'volunteer_only',p_volunteer_only,'broadcastId',p_id)
 FROM public.notification_preferences p WHERE p.push_enabled AND p_category=ANY(p.categories)
 AND (p_event_id IS NULL OR (NOT p_volunteer_only AND EXISTS(SELECT 1 FROM public.registrations WHERE user_id=p.user_id AND event_id=p_event_id AND status='confirmed')) OR (p_volunteer_only AND EXISTS(SELECT 1 FROM public.volunteer_assignments WHERE user_id=p.user_id AND event_id=p_event_id AND active)))
 AND (NOT p_members_only OR EXISTS(SELECT 1 FROM public.memberships WHERE user_id=p.user_id AND status='active' AND starts_at<=now() AND verified_at<=now() AND expires_at>now()));
 GET DIAGNOSTICS total=ROW_COUNT; RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.queue_notification_broadcast(uuid,text,uuid,boolean,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.queue_notification_broadcast(uuid,text,uuid,boolean,text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.new_notification_broadcast_id() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 RETURN gen_random_uuid();
END $$;
REVOKE ALL ON FUNCTION public.new_notification_broadcast_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_notification_broadcast_id() TO authenticated;
CREATE OR REPLACE FUNCTION public.schedule_notification_jobs() RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT thabaat_notifications.schedule_due_notifications() $$;
REVOKE ALL ON FUNCTION public.schedule_notification_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_notification_jobs() TO service_role;
COMMIT;
