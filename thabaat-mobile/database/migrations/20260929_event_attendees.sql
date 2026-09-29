-- Apply after 20260929_events_permissions.sql.
BEGIN;
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
  SELECT reg.id AS registration_id,p.full_name,t.name AS ticket_name,reg.status,reg.created_at AS registered_at
  FROM public.registrations reg JOIN public.profiles p ON p.id=reg.user_id JOIN public.ticket_types t ON t.id=reg.ticket_type_id
  WHERE reg.event_id=p_event_id ORDER BY reg.created_at,reg.id LIMIT 50 OFFSET p_offset
 ) a;
 RETURN jsonb_build_object('attendees',attendees,'counts',totals,'capacity',e.capacity,'reserved',
  (SELECT count(*) FROM public.paid_event_orders WHERE event_id=p_event_id AND status='pending'));
END $$;
REVOKE ALL ON FUNCTION public.get_event_attendees(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(uuid,integer) TO authenticated;
COMMIT;
