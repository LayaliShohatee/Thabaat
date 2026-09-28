-- Apply after 20260921_prototype_integrity.sql and 20260928_membership_billing.sql.
-- Hosted checkout is real; payment confirmation is MANUAL until provider integration exists.
BEGIN;
CREATE TABLE IF NOT EXISTS public.paid_event_checkout_configs (
 ticket_type_id uuid PRIMARY KEY REFERENCES public.ticket_types(id),
 form_id text NOT NULL UNIQUE, enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.paid_event_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
 event_id uuid NOT NULL REFERENCES public.events(id), ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id),
 form_id text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents > 0),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','refunded','cancelled')),
 provider_payment_id text UNIQUE, verified_at timestamptz, verification_note text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,event_id),
 CHECK(status <> 'completed' OR (provider_payment_id IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.event_access_details (
 event_id uuid PRIMARY KEY REFERENCES public.events(id), access_text text NOT NULL
);
ALTER TABLE public.paid_event_checkout_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_event_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_access_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS paid_checkout_configs_read ON public.paid_event_checkout_configs;
CREATE POLICY paid_checkout_configs_read ON public.paid_event_checkout_configs FOR SELECT TO authenticated USING(enabled);
DROP POLICY IF EXISTS paid_orders_read_self ON public.paid_event_orders;
CREATE POLICY paid_orders_read_self ON public.paid_event_orders FOR SELECT TO authenticated USING(user_id = auth.uid());
DROP POLICY IF EXISTS paid_event_access_read ON public.event_access_details;
CREATE POLICY paid_event_access_read ON public.event_access_details FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.registrations r JOIN public.paid_event_orders o
 ON o.user_id=r.user_id AND o.event_id=r.event_id AND o.ticket_type_id=r.ticket_type_id
 WHERE r.user_id=auth.uid() AND r.event_id=event_access_details.event_id AND r.status='confirmed' AND o.status='completed')
);
REVOKE ALL ON public.paid_event_checkout_configs,public.paid_event_orders,public.event_access_details FROM anon,authenticated;
GRANT SELECT ON public.paid_event_checkout_configs,public.paid_event_orders,public.event_access_details TO authenticated;
GRANT ALL ON public.paid_event_checkout_configs,public.paid_event_orders,public.event_access_details TO service_role;

CREATE OR REPLACE FUNCTION public.begin_paid_event_checkout(p_ticket_type_id uuid) RETURNS public.paid_event_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.ticket_types; e public.events; c public.paid_event_checkout_configs; o public.paid_event_orders; used integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_type_id;
 IF NOT FOUND OR t.price<=0 THEN RAISE EXCEPTION 'Paid ticket not found'; END IF;
 SELECT * INTO e FROM public.events WHERE id=t.event_id FOR UPDATE;
 IF e.event_date<=now() THEN RAISE EXCEPTION 'Registration closed'; END IF;
 SELECT * INTO c FROM public.paid_event_checkout_configs WHERE ticket_type_id=t.id AND enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'Paid checkout is not configured'; END IF;
 SELECT * INTO o FROM public.paid_event_orders WHERE user_id=auth.uid() AND event_id=e.id;
 IF FOUND THEN
  IF o.ticket_type_id<>t.id THEN RAISE EXCEPTION 'A checkout already exists for another ticket'; END IF;
  RETURN o;
 END IF;
 IF EXISTS(SELECT 1 FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id) THEN RAISE EXCEPTION 'Already registered'; END IF;
 SELECT (SELECT count(*) FROM public.registrations WHERE event_id=e.id AND status<>'cancelled')+
 (SELECT count(*) FROM public.paid_event_orders WHERE event_id=e.id AND status='pending') INTO used;
 IF used>=e.capacity THEN RAISE EXCEPTION 'No test seats available; contact the team before paying'; END IF;
 SELECT (SELECT count(*) FROM public.registrations WHERE ticket_type_id=t.id AND status<>'cancelled')+
 (SELECT count(*) FROM public.paid_event_orders WHERE ticket_type_id=t.id AND status='pending') INTO used;
 IF used>=t.quantity THEN RAISE EXCEPTION 'Ticket inventory unavailable'; END IF;
 INSERT INTO public.paid_event_orders(user_id,event_id,ticket_type_id,form_id,amount_cents)
 VALUES(auth.uid(),e.id,t.id,c.form_id,(t.price*100)::integer) RETURNING * INTO o;
 RETURN o;
END; $$;
REVOKE ALL ON FUNCTION public.begin_paid_event_checkout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_paid_event_checkout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_verified_event_payment(p_user uuid,p_event uuid,p_ticket uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.paid_event_orders o JOIN public.ticket_types t ON t.id=o.ticket_type_id
 WHERE o.user_id=p_user AND o.event_id=p_event AND o.ticket_type_id=p_ticket AND t.event_id=p_event
 AND o.status='completed' AND o.provider_payment_id IS NOT NULL AND o.verified_at IS NOT NULL AND o.amount_cents=(t.price*100)::integer AND o.currency='USD');
$$;
REVOKE ALL ON FUNCTION public.has_verified_event_payment(uuid,uuid,uuid) FROM PUBLIC;
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
  SELECT count(*) INTO used FROM public.registrations WHERE event_id = NEW.event_id AND status <> 'cancelled';
  IF used >= event_row.capacity THEN RAISE EXCEPTION 'Event is sold out'; END IF;
  SELECT count(*) INTO used FROM public.registrations WHERE ticket_type_id = NEW.ticket_type_id AND status <> 'cancelled';
  IF used >= ticket_row.quantity THEN RAISE EXCEPTION 'Ticket type is sold out'; END IF;
  NEW.status := 'confirmed';
  RETURN NEW;
END;
$$;

-- Execute only after an operator independently checks the actual CharityStack dashboard payment.
-- This function validates bookkeeping; it does NOT call CharityStack or verify a receipt itself.
CREATE OR REPLACE FUNCTION public.confirm_paid_event_manually(p_order_id uuid,p_payment_id text,p_amount_cents integer,p_currency text,p_form_id text,p_note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.paid_event_orders; registration_id uuid; title text;
BEGIN
 SELECT * INTO o FROM public.paid_event_orders WHERE id=p_order_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
 PERFORM 1 FROM public.events WHERE id=o.event_id FOR UPDATE;
 SELECT * INTO o FROM public.paid_event_orders WHERE id=p_order_id FOR UPDATE;
 IF p_payment_id IS NULL OR length(trim(p_payment_id))<3 OR p_note IS NULL OR length(trim(p_note))<15 THEN RAISE EXCEPTION 'Provider payment ID and verification note required'; END IF;
 IF p_amount_cents IS DISTINCT FROM o.amount_cents OR p_currency IS DISTINCT FROM o.currency OR p_form_id IS DISTINCT FROM o.form_id THEN RAISE EXCEPTION 'Payment does not match checkout'; END IF;
 IF o.status='completed' THEN
  IF o.provider_payment_id<>p_payment_id THEN RAISE EXCEPTION 'Checkout already linked to a different payment'; END IF;
  SELECT id INTO registration_id FROM public.registrations WHERE user_id=o.user_id AND event_id=o.event_id AND status='confirmed';
  RETURN registration_id;
 END IF;
 IF o.status<>'pending' THEN RAISE EXCEPTION 'Checkout is not pending'; END IF;
 IF EXISTS(SELECT 1 FROM public.checkout_attempts WHERE provider_payment_id=p_payment_id) THEN RAISE EXCEPTION 'Payment already used for an internal check'; END IF;
 UPDATE public.paid_event_orders SET status='completed',provider_payment_id=p_payment_id,verified_at=now(),verification_note=p_note WHERE id=o.id;
 INSERT INTO public.registrations(user_id,event_id,ticket_type_id,status) VALUES(o.user_id,o.event_id,o.ticket_type_id,'confirmed') RETURNING id INTO registration_id;
 SELECT e.title INTO title FROM public.events e WHERE id=o.event_id;
 INSERT INTO public.payment_records(user_id,provider_payment_id,purpose,description,amount_cents,currency,status,paid_at,verified_at)
 VALUES(o.user_id,p_payment_id,'event',title,o.amount_cents,o.currency,'completed',now(),now());
 RETURN registration_id;
END; $$;
REVOKE ALL ON FUNCTION public.confirm_paid_event_manually(uuid,text,integer,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paid_event_manually(uuid,text,integer,text,text,text) TO service_role;
COMMIT;
