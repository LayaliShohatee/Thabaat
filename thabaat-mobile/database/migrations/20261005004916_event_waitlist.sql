BEGIN;
CREATE TABLE IF NOT EXISTS public.event_waitlist (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
 event_id uuid NOT NULL REFERENCES public.events(id), ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id),
 status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','offered','accepted','left')),
 joined_at timestamptz NOT NULL DEFAULT now(), offer_expires_at timestamptz, UNIQUE(user_id,event_id)
);
ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_waitlist_self ON public.event_waitlist;
CREATE POLICY event_waitlist_self ON public.event_waitlist FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.event_waitlist FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.event_waitlist TO authenticated;
GRANT ALL ON public.event_waitlist TO service_role;

-- Central inventory: holds are counted only while valid. Called inside event locks.
CREATE OR REPLACE FUNCTION public.event_reserved_seats(p_event_id uuid,p_ticket_type_id uuid DEFAULT NULL) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT count(*) FROM public.registrations WHERE event_id=p_event_id AND status<>'cancelled' AND (p_ticket_type_id IS NULL OR ticket_type_id=p_ticket_type_id))+
 (SELECT count(*) FROM public.paid_event_orders WHERE event_id=p_event_id AND status='pending' AND (p_ticket_type_id IS NULL OR ticket_type_id=p_ticket_type_id))+
 (SELECT count(*) FROM public.event_waitlist WHERE event_id=p_event_id AND status='offered' AND offer_expires_at>now() AND (p_ticket_type_id IS NULL OR ticket_type_id=p_ticket_type_id));
$$;
CREATE OR REPLACE FUNCTION public.join_event_waitlist(p_event_id uuid,p_ticket_type_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; t public.ticket_types; w public.event_waitlist;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Event is unavailable'; END IF;
 IF coalesce((to_jsonb(e)->>'members_only')::boolean,false) AND NOT EXISTS(SELECT 1 FROM public.memberships WHERE user_id=auth.uid() AND status='active' AND starts_at<=now() AND expires_at>now() AND verified_at<=now()) THEN RAISE EXCEPTION 'Active membership required'; END IF;
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_type_id;
 IF NOT FOUND OR t.event_id<>e.id OR t.price<>0 THEN RAISE EXCEPTION 'Choose a free ticket for this event'; END IF;
 IF EXISTS(SELECT 1 FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id AND status<>'cancelled') OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE user_id=auth.uid() AND event_id=e.id AND status='pending') THEN RAISE EXCEPTION 'Already registered or checkout pending'; END IF;
 SELECT * INTO w FROM public.event_waitlist WHERE user_id=auth.uid() AND event_id=e.id FOR UPDATE;
 IF FOUND AND (w.status='waiting' OR (w.status='offered' AND w.offer_expires_at>now())) THEN RETURN to_jsonb(w); END IF;
 IF public.event_reserved_seats(e.id)<e.capacity AND public.event_reserved_seats(e.id,t.id)<t.quantity THEN RAISE EXCEPTION 'A seat is available; register directly'; END IF;
 INSERT INTO public.event_waitlist(user_id,event_id,ticket_type_id) VALUES(auth.uid(),e.id,t.id)
 ON CONFLICT(user_id,event_id) DO UPDATE SET ticket_type_id=excluded.ticket_type_id,status='waiting',joined_at=now(),offer_expires_at=NULL RETURNING * INTO w;
 RETURN to_jsonb(w);
END $$;
CREATE OR REPLACE FUNCTION public.leave_event_waitlist(p_event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM 1 FROM public.events WHERE id=p_event_id FOR UPDATE;
 UPDATE public.event_waitlist SET status='left',offer_expires_at=NULL WHERE event_id=p_event_id AND user_id=auth.uid() AND status IN ('waiting','offered');
END $$;
CREATE OR REPLACE FUNCTION public.manage_event_waitlist(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.current_staff_role()='admin',false) OR (coalesce(public.current_staff_role()='organizer',false) AND EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND created_by=auth.uid()))) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'full_name',p.full_name,'ticket_type_id',w.ticket_type_id,'ticket_name',t.name,'status',w.status,'joined_at',w.joined_at,'offer_expires_at',w.offer_expires_at) ORDER BY w.joined_at,w.id) FROM public.event_waitlist w JOIN public.profiles p ON p.id=w.user_id JOIN public.ticket_types t ON t.id=w.ticket_type_id WHERE w.event_id=p_event_id),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.offer_next_waitlist_seat(p_event_id uuid,p_ticket_type_id uuid,p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; t public.ticket_types; w public.event_waitlist;
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.current_staff_role()='admin',false) OR (coalesce(public.current_staff_role()='organizer',false) AND EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND created_by=auth.uid()))) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Event is unavailable'; END IF;
 IF p_expires_at IS NULL OR p_expires_at<=now() OR p_expires_at>e.event_date OR p_expires_at>now()+interval '7 days' THEN RAISE EXCEPTION 'Offer expiry must be within 7 days and before the event'; END IF;
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_type_id AND event_id=e.id AND price=0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Free ticket not found'; END IF;
 UPDATE public.event_waitlist SET status='waiting',offer_expires_at=NULL WHERE event_id=e.id AND status='offered' AND offer_expires_at<=now();
 IF public.event_reserved_seats(e.id)>=e.capacity OR public.event_reserved_seats(e.id,t.id)>=t.quantity THEN RAISE EXCEPTION 'No seat available to offer'; END IF;
 SELECT * INTO w FROM public.event_waitlist WHERE event_id=e.id AND ticket_type_id=t.id AND status='waiting'
 AND (NOT coalesce((to_jsonb(e)->>'members_only')::boolean,false) OR EXISTS(SELECT 1 FROM public.memberships WHERE user_id=event_waitlist.user_id AND status='active' AND starts_at<=now() AND expires_at>now() AND verified_at<=now()))
 ORDER BY joined_at,id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No eligible waiting attendee'; END IF;
 UPDATE public.event_waitlist SET status='offered',offer_expires_at=p_expires_at WHERE id=w.id RETURNING * INTO w;
 RETURN to_jsonb(w);
END $$;
CREATE OR REPLACE FUNCTION public.accept_waitlist_offer(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.event_waitlist; r jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM 1 FROM public.events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO w FROM public.event_waitlist WHERE event_id=p_event_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;
 IF w.status='accepted' THEN
  SELECT to_jsonb(reg) INTO r FROM public.registrations reg WHERE event_id=p_event_id AND user_id=auth.uid() AND status='confirmed';
  IF r IS NOT NULL THEN RETURN r; END IF;
 END IF;
 IF w.status<>'offered' OR w.offer_expires_at<=now() THEN RAISE EXCEPTION 'No valid seat offer; join again if needed'; END IF;
 UPDATE public.event_waitlist SET status='accepted',offer_expires_at=NULL WHERE id=w.id;
 r := public.reserve_free_event(p_event_id,w.ticket_type_id); -- Gate/inventory revalidated; failure rolls back acceptance.
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.event_reserved_seats(uuid,uuid),public.join_event_waitlist(uuid,uuid),public.leave_event_waitlist(uuid),public.manage_event_waitlist(uuid),public.offer_next_waitlist_seat(uuid,uuid,timestamptz),public.accept_waitlist_offer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_event_waitlist(uuid,uuid),public.leave_event_waitlist(uuid),public.manage_event_waitlist(uuid),public.offer_next_waitlist_seat(uuid,uuid,timestamptz),public.accept_waitlist_offer(uuid) TO authenticated;
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
 IF public.event_reserved_seats(e.id)>=e.capacity THEN RAISE EXCEPTION 'Event is sold out'; END IF;
 IF public.event_reserved_seats(e.id,t.id)>=t.quantity THEN RAISE EXCEPTION 'Ticket type is sold out'; END IF;
 IF reactivating THEN
  UPDATE public.registrations SET status='confirmed',ticket_type_id=t.id WHERE id=r.id RETURNING * INTO r;
 ELSE
  INSERT INTO public.registrations(user_id,event_id,ticket_type_id,status) VALUES(auth.uid(),e.id,t.id,'confirmed') RETURNING * INTO r;
 END IF;
 INSERT INTO public.registration_history(registration_id,user_id,event_id,action) VALUES(r.id,auth.uid(),e.id,CASE WHEN reactivating THEN 'reactivated' ELSE 'registered' END);
 RETURN to_jsonb(r);
END $$;


CREATE OR REPLACE FUNCTION public.validate_free_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  event_row public.events%ROWTYPE;
  ticket_row public.ticket_types%ROWTYPE;
  used integer;
BEGIN
  IF (auth.uid() IS NULL AND NOT public.has_verified_event_payment(NEW.user_id,NEW.event_id,NEW.ticket_type_id)) OR (auth.uid() IS NOT NULL AND NEW.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'You can only register yourself';
  END IF;
  SELECT * INTO event_row FROM public.events WHERE id = NEW.event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF event_row.event_date <= now() THEN RAISE EXCEPTION 'Registration is closed for this event'; END IF;
  SELECT * INTO ticket_row FROM public.ticket_types WHERE id = NEW.ticket_type_id;
  IF NOT FOUND OR ticket_row.event_id <> NEW.event_id THEN RAISE EXCEPTION 'Ticket does not belong to this event'; END IF;
  IF ticket_row.price > 0 AND NOT public.has_verified_event_payment(NEW.user_id,NEW.event_id,NEW.ticket_type_id) THEN RAISE EXCEPTION 'Paid checkout requires verified payment'; END IF;
  used := public.event_reserved_seats(NEW.event_id);
  IF used >= event_row.capacity THEN RAISE EXCEPTION 'Event is sold out'; END IF;
  used := public.event_reserved_seats(NEW.event_id,NEW.ticket_type_id);
  IF used >= ticket_row.quantity THEN RAISE EXCEPTION 'Ticket type is sold out'; END IF;
  NEW.status := 'confirmed';
  RETURN NEW;
END;
$$;


COMMIT;
