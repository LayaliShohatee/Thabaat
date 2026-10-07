BEGIN;
-- Free-ticket lifecycle only. Paid cancellation/refunds remain provider-controlled.
CREATE TABLE IF NOT EXISTS public.registration_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES public.registrations(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), event_id uuid NOT NULL REFERENCES public.events(id),
 action text NOT NULL CHECK(action IN ('registered','cancelled','reactivated')), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.registration_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registration_history_self ON public.registration_history;
CREATE POLICY registration_history_self ON public.registration_history FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.registration_history FROM anon,authenticated;
GRANT SELECT ON public.registration_history TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_free_event(p_event_id uuid,p_ticket_type_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; t public.ticket_types; r public.registrations; used integer; reactivating boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR e.archived THEN RAISE EXCEPTION 'Event is unavailable'; END IF;
 IF e.event_date<=now() THEN RAISE EXCEPTION 'Registration is closed'; END IF;
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_type_id;
 IF NOT FOUND OR t.event_id<>e.id THEN RAISE EXCEPTION 'Ticket does not belong to this event'; END IF;
 IF t.price<>0 THEN RAISE EXCEPTION 'Paid checkout requires verified payment'; END IF;
 SELECT * INTO r FROM public.registrations WHERE event_id=e.id AND user_id=auth.uid() FOR UPDATE;
 IF FOUND AND r.status<>'cancelled' THEN
  IF r.ticket_type_id<>t.id THEN RAISE EXCEPTION 'Already registered with another ticket'; END IF;
  RETURN to_jsonb(r); -- Response lost/repeated tap is safe; do not allocate or log twice.
 END IF;
 reactivating := r.id IS NOT NULL;
 IF reactivating AND EXISTS(SELECT 1 FROM public.paid_event_orders WHERE event_id=e.id AND user_id=auth.uid() AND status='completed') THEN
  RAISE EXCEPTION 'Paid registration requires operator review';
 END IF;
 SELECT (SELECT count(*) FROM public.registrations WHERE event_id=e.id AND status<>'cancelled')+
        (SELECT count(*) FROM public.paid_event_orders WHERE event_id=e.id AND status='pending') INTO used;
 IF used>=e.capacity THEN RAISE EXCEPTION 'Event is sold out'; END IF;
 SELECT (SELECT count(*) FROM public.registrations WHERE ticket_type_id=t.id AND status<>'cancelled')+
        (SELECT count(*) FROM public.paid_event_orders WHERE ticket_type_id=t.id AND status='pending') INTO used;
 IF used>=t.quantity THEN RAISE EXCEPTION 'Ticket type is sold out'; END IF;
 IF reactivating THEN
  UPDATE public.registrations SET status='confirmed',ticket_type_id=t.id WHERE id=r.id RETURNING * INTO r;
 ELSE
  INSERT INTO public.registrations(user_id,event_id,ticket_type_id,status) VALUES(auth.uid(),e.id,t.id,'confirmed') RETURNING * INTO r;
 END IF;
 INSERT INTO public.registration_history(registration_id,user_id,event_id,action) VALUES(r.id,auth.uid(),e.id,CASE WHEN reactivating THEN 'reactivated' ELSE 'registered' END);
 RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_free_registration(p_registration_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; r public.registrations; target_event_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT reg.event_id INTO target_event_id FROM public.registrations reg WHERE reg.id=p_registration_id AND reg.user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
 -- Same lock order as allocation: event, then registration. Serializes released seats.
 SELECT * INTO e FROM public.events WHERE id=target_event_id FOR UPDATE;
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id AND user_id=auth.uid() FOR UPDATE;
 IF r.status='cancelled' THEN RETURN to_jsonb(r); END IF;
 IF e.event_date<=now() THEN RAISE EXCEPTION 'Cancellation is closed after the event starts'; END IF;
 IF r.status<>'confirmed' OR EXISTS(SELECT 1 FROM public.ticket_types WHERE id=r.ticket_type_id AND price<>0)
 OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE event_id=r.event_id AND user_id=r.user_id AND status='completed') THEN
  RAISE EXCEPTION 'Paid or pending registrations require operator review';
 END IF;
 UPDATE public.registrations SET status='cancelled' WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.registration_history(registration_id,user_id,event_id,action) VALUES(r.id,auth.uid(),r.event_id,'cancelled');
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.reserve_free_event(uuid,uuid),public.cancel_free_registration(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_free_event(uuid,uuid),public.cancel_free_registration(uuid) TO authenticated;
COMMIT;
