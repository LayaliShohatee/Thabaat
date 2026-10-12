-- Local only. Free tickets only; sender retains the seat until explicit recipient acceptance.
BEGIN;
CREATE TABLE public.free_ticket_gifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES public.registrations(id),
 event_id uuid NOT NULL REFERENCES public.events(id), ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id),
 sender_id uuid NOT NULL REFERENCES public.profiles(id), recipient_id uuid NOT NULL REFERENCES public.profiles(id),
 recipient_registration_id uuid REFERENCES public.registrations(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','revoked','expired')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 resolved_at timestamptz, request_id uuid NOT NULL UNIQUE, CHECK(sender_id<>recipient_id)
);
CREATE UNIQUE INDEX free_ticket_gifts_one_pending ON public.free_ticket_gifts(registration_id) WHERE status='pending';
CREATE INDEX free_ticket_gifts_sender_date ON public.free_ticket_gifts(sender_id,created_at DESC);
CREATE INDEX free_ticket_gifts_recipient_date ON public.free_ticket_gifts(recipient_id,created_at DESC);
ALTER TABLE public.free_ticket_gifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_ticket_gifts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.free_ticket_gifts TO service_role;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.registration_history'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%action%' LOOP EXECUTE format('ALTER TABLE public.registration_history DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE public.registration_history ADD CONSTRAINT registration_history_lifecycle_action CHECK(action IN ('registered','cancelled','reactivated','transferred_out','transferred_in'));
CREATE FUNCTION public.invalidate_pending_gifts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.ticket_type_id IS DISTINCT FROM OLD.ticket_type_id OR NEW.event_id IS DISTINCT FROM OLD.event_id THEN
  UPDATE public.free_ticket_gifts SET status='revoked',resolved_at=now() WHERE registration_id=NEW.id AND status='pending';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invalidate_pending_gifts_on_registration AFTER UPDATE OF status,user_id,ticket_type_id,event_id ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.invalidate_pending_gifts();
CREATE FUNCTION public.begin_free_ticket_gift(p_registration_id uuid,p_recipient_id uuid,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations; e public.events; g public.free_ticket_gifts;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
 SELECT * INTO e FROM public.events WHERE id=r.event_id FOR UPDATE;
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id AND user_id=auth.uid() FOR UPDATE;
 SELECT * INTO g FROM public.free_ticket_gifts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF g.sender_id<>auth.uid() OR g.registration_id<>p_registration_id OR g.recipient_id<>p_recipient_id THEN RAISE EXCEPTION 'Gift request already used for different details'; END IF;
  RETURN to_jsonb(g)||jsonb_build_object('recipient_name',(SELECT full_name FROM public.profiles WHERE id=g.recipient_id));
 END IF;
 IF p_request_id IS NULL OR p_recipient_id IS NULL OR p_recipient_id=auth.uid() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_recipient_id) THEN RAISE EXCEPTION 'Choose a different known existing account ID'; END IF;
 IF e.archived OR e.event_date<=now() OR r.status<>'confirmed' OR NOT EXISTS(SELECT 1 FROM public.ticket_types WHERE id=r.ticket_type_id AND event_id=e.id AND price=0) OR EXISTS(SELECT 1 FROM public.event_checkins WHERE registration_id=r.id) OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE user_id=r.user_id AND event_id=e.id AND status IN ('pending','completed')) THEN RAISE EXCEPTION 'Only future unchecked-in free registrations can be gifted'; END IF;
 IF EXISTS(SELECT 1 FROM public.registrations WHERE user_id=p_recipient_id AND event_id=e.id AND status<>'cancelled') OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE user_id=p_recipient_id AND event_id=e.id AND status IN ('pending','completed')) THEN RAISE EXCEPTION 'Recipient already has a registration or provider checkout'; END IF;
 IF e.members_only AND NOT public.has_active_membership(p_recipient_id) THEN RAISE EXCEPTION 'Recipient requires active verified membership'; END IF;
 UPDATE public.free_ticket_gifts SET status='expired',resolved_at=now() WHERE registration_id=r.id AND status='pending' AND expires_at<=now();
 IF EXISTS(SELECT 1 FROM public.free_ticket_gifts WHERE registration_id=r.id AND status='pending') THEN RAISE EXCEPTION 'Revoke the current gift before choosing another recipient'; END IF;
 INSERT INTO public.free_ticket_gifts(registration_id,event_id,ticket_type_id,sender_id,recipient_id,expires_at,request_id) VALUES(r.id,e.id,r.ticket_type_id,auth.uid(),p_recipient_id,least(now()+interval '24 hours',e.event_date),p_request_id) RETURNING * INTO g;
 RETURN to_jsonb(g)||jsonb_build_object('recipient_name',(SELECT full_name FROM public.profiles WHERE id=g.recipient_id));
END $$;
CREATE FUNCTION public.accept_free_ticket_gift(p_gift_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.free_ticket_gifts; e public.events; sender public.registrations; recipient public.registrations;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO g FROM public.free_ticket_gifts WHERE id=p_gift_id AND recipient_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;
 SELECT * INTO e FROM public.events WHERE id=g.event_id FOR UPDATE;
 SELECT * INTO g FROM public.free_ticket_gifts WHERE id=p_gift_id AND recipient_id=auth.uid() FOR UPDATE;
 IF g.status='accepted' THEN
  RETURN to_jsonb(g); -- Lost response/repeated confirmation cannot allocate a second seat or regrant a cancelled ticket.
 END IF;
 IF g.status<>'pending' OR g.expires_at<=now() OR e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Gift is no longer available'; END IF;
 SELECT * INTO sender FROM public.registrations WHERE id=g.registration_id AND user_id=g.sender_id AND event_id=e.id FOR UPDATE;
 IF NOT FOUND OR sender.status<>'confirmed' OR sender.ticket_type_id<>g.ticket_type_id OR EXISTS(SELECT 1 FROM public.event_checkins WHERE registration_id=sender.id) OR NOT EXISTS(SELECT 1 FROM public.ticket_types WHERE id=g.ticket_type_id AND event_id=e.id AND price=0) OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE user_id=g.sender_id AND event_id=e.id AND status IN ('pending','completed')) THEN RAISE EXCEPTION 'Sender ticket is no longer eligible'; END IF;
 IF e.members_only AND NOT public.has_active_membership(auth.uid()) THEN RAISE EXCEPTION 'Active verified membership required to accept this gift'; END IF;
 SELECT * INTO recipient FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id FOR UPDATE;
 IF (recipient.id IS NOT NULL AND recipient.status<>'cancelled') OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE user_id=auth.uid() AND event_id=e.id AND status IN ('pending','completed')) THEN RAISE EXCEPTION 'Already registered or provider checkout pending'; END IF;
 -- Resolve offer first so the registration-change trigger only invalidates other pending gifts.
 UPDATE public.free_ticket_gifts SET status='accepted',resolved_at=now() WHERE id=g.id;
 UPDATE public.registrations SET status='cancelled' WHERE id=sender.id;
 -- Release the recipient's own waitlist hold, then reuse the central allocation/gating path.
 UPDATE public.event_waitlist SET status='left',offer_expires_at=NULL WHERE user_id=auth.uid() AND event_id=e.id AND status IN ('waiting','offered');
 PERFORM public.reserve_free_event(e.id,g.ticket_type_id);
 SELECT * INTO recipient FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id;
 INSERT INTO public.registration_history(registration_id,user_id,event_id,action) VALUES(sender.id,g.sender_id,e.id,'transferred_out'),(recipient.id,auth.uid(),e.id,'transferred_in');
 UPDATE public.free_ticket_gifts SET recipient_registration_id=recipient.id WHERE id=g.id RETURNING * INTO g;
 RETURN to_jsonb(g);
END $$;
CREATE FUNCTION public.resolve_free_ticket_gift(p_gift_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.free_ticket_gifts;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO g FROM public.free_ticket_gifts WHERE id=p_gift_id AND (sender_id=auth.uid() OR recipient_id=auth.uid());
 IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;
 PERFORM 1 FROM public.events WHERE id=g.event_id FOR UPDATE;
 SELECT * INTO g FROM public.free_ticket_gifts WHERE id=p_gift_id FOR UPDATE;
 IF p_action IS NULL OR (p_action='revoked' AND g.sender_id<>auth.uid()) OR (p_action='declined' AND g.recipient_id<>auth.uid()) OR p_action NOT IN ('revoked','declined') THEN RAISE EXCEPTION 'Gift action not permitted'; END IF;
 IF g.status=p_action THEN RETURN; END IF;
 IF g.status<>'pending' THEN RAISE EXCEPTION 'Gift is already resolved'; END IF;
 UPDATE public.free_ticket_gifts SET status=CASE WHEN expires_at<=now() THEN 'expired' ELSE p_action END,resolved_at=now() WHERE id=g.id;
END $$;
CREATE FUNCTION public.my_free_ticket_gifts() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 RETURN jsonb_build_object('gifts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id) FROM (SELECT g.id,g.registration_id,g.event_id,g.sender_id,g.recipient_id,g.recipient_registration_id,CASE WHEN g.status='pending' AND g.expires_at<=now() THEN 'expired' ELSE g.status END AS status,g.expires_at,g.created_at,e.title,e.event_date,e.members_only,s.full_name AS sender_name,r.full_name AS recipient_name FROM public.free_ticket_gifts g JOIN public.events e ON e.id=g.event_id JOIN public.profiles s ON s.id=g.sender_id JOIN public.profiles r ON r.id=g.recipient_id WHERE g.sender_id=auth.uid() OR g.recipient_id=auth.uid() ORDER BY g.created_at DESC,g.id LIMIT 100) x),'[]'::jsonb),'registrations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'event_id',e.id,'title',e.title,'event_date',e.event_date,'ticket_name',t.name,'members_only',e.members_only) ORDER BY e.event_date,r.id) FROM public.registrations r JOIN public.events e ON e.id=r.event_id JOIN public.ticket_types t ON t.id=r.ticket_type_id WHERE r.user_id=auth.uid() AND r.status='confirmed' AND t.price=0 AND NOT e.archived AND e.event_date>now() AND NOT EXISTS(SELECT 1 FROM public.event_checkins c WHERE c.registration_id=r.id) AND NOT EXISTS(SELECT 1 FROM public.paid_event_orders po WHERE po.user_id=r.user_id AND po.event_id=e.id AND po.status IN ('pending','completed'))),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.invalidate_pending_gifts(),public.begin_free_ticket_gift(uuid,uuid,uuid),public.accept_free_ticket_gift(uuid),public.resolve_free_ticket_gift(uuid,text),public.my_free_ticket_gifts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_free_ticket_gift(uuid,uuid,uuid),public.accept_free_ticket_gift(uuid),public.resolve_free_ticket_gift(uuid,text),public.my_free_ticket_gifts() TO authenticated;
COMMIT;
