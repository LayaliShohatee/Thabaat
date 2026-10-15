-- Follow-up to 20261014130000: the check-in list only offers "Check in" when check-in would succeed,
-- i.e. the caller may staff the event AND it is inside the event window (4 hours before to 24 hours after the start).
-- Applied to the thabaat-staging development project on 2026-10-14.
BEGIN;
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
    SELECT jsonb_build_object('kind','registration','id',r.id,'full_name',p.full_name,'ticket_name',t.name,'checked_in_at',c.checked_in_at) x
     FROM public.registrations r JOIN public.profiles p ON p.id=r.user_id JOIN public.ticket_types t ON t.id=r.ticket_type_id LEFT JOIN public.event_checkins c ON c.registration_id=r.id
     WHERE r.event_id=p_event_id AND r.status='confirmed' AND lower(p.full_name) LIKE needle
    UNION ALL
    SELECT jsonb_build_object('kind','walk_in','id',w.id,'full_name',w.full_name,'ticket_name','Walk-in','checked_in_at',w.checked_in_at)
     FROM public.event_walk_ins w WHERE w.event_id=p_event_id AND lower(w.full_name) LIKE needle
    LIMIT 300) people),'[]'::jsonb));
END $$;
COMMIT;
