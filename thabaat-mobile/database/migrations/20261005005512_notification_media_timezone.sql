-- After notification preferences, media library and event details migrations. Local only.
BEGIN;
CREATE OR REPLACE FUNCTION thabaat_notifications.enqueue_published_video() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.published AND (TG_OP='INSERT' OR NOT OLD.published) THEN
 INSERT INTO thabaat_notifications.outbox(user_id,kind,dedupe_key,payload)
 SELECT p.user_id,'video','video:'||NEW.id||':'||p.user_id,jsonb_build_object('title','New member video','body',NEW.title,'mediaId',NEW.id)
 FROM public.notification_preferences p JOIN public.memberships m ON m.user_id=p.user_id
 WHERE p.push_enabled AND p.video_alerts AND m.status='active' AND m.starts_at<=now() AND m.verified_at<=now() AND m.expires_at>now()
 ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION thabaat_notifications.enqueue_published_video() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notification_published_video ON public.media_items;
CREATE TRIGGER notification_published_video AFTER INSERT OR UPDATE OF published ON public.media_items FOR EACH ROW EXECUTE FUNCTION thabaat_notifications.enqueue_published_video();
-- Separate morning insertion keeps missing venue timezone explicit and skips morning after start.
CREATE OR REPLACE FUNCTION public.schedule_notification_jobs() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE total integer; extra integer;
BEGIN
 total:=thabaat_notifications.schedule_due_notifications();
 INSERT INTO thabaat_notifications.outbox(user_id,registration_id,event_id,kind,dedupe_key,available_at,source_event_date,payload)
 SELECT r.user_id,r.id,e.id,'morning','reminder:'||r.id||':'||e.event_date||':morning:'||e.timezone,
 (((e.event_date AT TIME ZONE e.timezone)::date+time '09:00') AT TIME ZONE e.timezone),e.event_date,jsonb_build_object('timezone',e.timezone)
 FROM public.registrations r JOIN public.events e ON e.id=r.event_id JOIN public.notification_preferences p ON p.user_id=r.user_id
 JOIN pg_catalog.pg_timezone_names zones ON zones.name=e.timezone
 WHERE r.status='confirmed' AND NOT e.archived AND p.push_enabled AND 'morning'=ANY(p.reminders)
 AND (((e.event_date AT TIME ZONE e.timezone)::date+time '09:00') AT TIME ZONE e.timezone)>now()
 AND (((e.event_date AT TIME ZONE e.timezone)::date+time '09:00') AT TIME ZONE e.timezone)<e.event_date
 ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS extra=ROW_COUNT; RETURN total+extra;
END $$;
REVOKE ALL ON FUNCTION public.schedule_notification_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_notification_jobs() TO service_role;
CREATE OR REPLACE FUNCTION thabaat_notifications.video_is_published(p_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.media_items WHERE id::text=p_id AND published) $$;
REVOKE ALL ON FUNCTION thabaat_notifications.video_is_published(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION thabaat_notifications.video_is_published(text) TO service_role;
COMMIT;
