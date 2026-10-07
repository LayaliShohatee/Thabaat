-- Local review only: aggregate reports, no payment writes or personal details.
BEGIN;
CREATE FUNCTION public.admin_analytics(p_days integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cutoff timestamptz; result jsonb;
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_days IS NULL OR p_days NOT IN (7,30,90) THEN RAISE EXCEPTION 'Choose 7, 30 or 90 days'; END IF;
 cutoff := now()-make_interval(days=>p_days);
 SELECT jsonb_build_object(
  'as_of',now(),'days',p_days,'since',cutoff,
  'users',jsonb_build_object('total',(SELECT count(*) FROM public.profiles),'new',(SELECT count(*) FROM public.profiles WHERE created_at>=cutoff AND created_at<=now())),
  'memberships',jsonb_build_object('current_verified',(SELECT count(*) FROM public.memberships WHERE status='active' AND verified_at<=now() AND starts_at<=now() AND expires_at>now()),'complimentary_current',(SELECT count(*) FROM public.memberships WHERE status='active' AND source='complimentary' AND verified_at<=now() AND starts_at<=now() AND expires_at>now())),
  'events',jsonb_build_object('upcoming',(SELECT count(*) FROM public.events WHERE NOT archived AND event_date>=now()),'archived',(SELECT count(*) FROM public.events WHERE archived)),
  'registrations',jsonb_build_object('confirmed',(SELECT count(*) FROM public.registrations WHERE status='confirmed'),'cancelled',(SELECT count(*) FROM public.registrations WHERE status='cancelled'),'new',(SELECT count(*) FROM public.registrations WHERE created_at>=cutoff AND created_at<=now()),'checked_in',(SELECT count(*) FROM public.event_checkins)),
  'verified_payments',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT purpose,currency,count(*) AS count,sum(amount_cents)::bigint AS amount_cents FROM public.payment_records WHERE status='completed' AND verified_at<=now() AND paid_at BETWEEN cutoff AND now() GROUP BY purpose,currency ORDER BY purpose,currency) p),'[]'::jsonb),
  'daily',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM (SELECT to_char(day,'YYYY-MM-DD') AS day,(SELECT count(*) FROM public.profiles WHERE created_at>=day AT TIME ZONE 'UTC' AND created_at<(day+interval '1 day') AT TIME ZONE 'UTC' AND created_at<=now()) AS new_users,(SELECT count(*) FROM public.registrations WHERE created_at>=day AT TIME ZONE 'UTC' AND created_at<(day+interval '1 day') AT TIME ZONE 'UTC' AND created_at<=now()) AS new_registrations FROM generate_series(date_trunc('day',cutoff AT TIME ZONE 'UTC'),date_trunc('day',now() AT TIME ZONE 'UTC'),interval '1 day') day) d),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_analytics(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics(integer) TO authenticated;
COMMIT;
