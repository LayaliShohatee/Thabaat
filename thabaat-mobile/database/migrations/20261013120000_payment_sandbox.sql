-- Test-mode payment sandbox: exercises paid tickets, memberships, donations and refunds end to end without a
-- payment provider (the client declined CharityStack). No money moves. Every purchase function refuses unless an
-- administrator has switched the project's payments mode to 'sandbox'; it defaults to 'off' and must stay 'off' in
-- production. Payment IDs are prefixed 'sandbox_' so test records are always distinguishable.
-- Requires 20260928_paid_event_test, 20261005012003_campaign_administration and 20261012120200_refunds_discounts.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_settings(key text PRIMARY KEY, value text NOT NULL, updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM PUBLIC,anon,authenticated;
INSERT INTO public.app_settings(key,value) VALUES('payments_mode','off') ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.payments_mode() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT value FROM public.app_settings WHERE key='payments_mode'),'off')
$$;
CREATE OR REPLACE FUNCTION public.set_payments_mode(p_mode text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_mode IS NULL OR p_mode NOT IN ('off','sandbox') THEN RAISE EXCEPTION 'Payments mode must be off or sandbox'; END IF;
 INSERT INTO public.app_settings(key,value,updated_by,updated_at) VALUES('payments_mode',p_mode,auth.uid(),now())
 ON CONFLICT (key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.assert_payments_sandbox() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.payments_mode()<>'sandbox' THEN RAISE EXCEPTION 'Test payments are turned off'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF pg_catalog.to_regprocedure('public.assert_active_account()') IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
END $$;

-- Paid ticket: server-side price (member discount + optional code), completed order, confirmed registration, payment record.
CREATE OR REPLACE FUNCTION public.sandbox_purchase_ticket(p_ticket_id uuid,p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.ticket_types; e public.events; o public.paid_event_orders; q jsonb; payment_id text:='sandbox_'||replace(gen_random_uuid()::text,'-',''); registration_id uuid;
BEGIN
 PERFORM public.assert_payments_sandbox();
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_id;
 IF NOT FOUND OR t.price<=0 THEN RAISE EXCEPTION 'Choose a paid ticket'; END IF;
 SELECT * INTO e FROM public.events WHERE id=t.event_id FOR UPDATE;
 IF e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Registration is closed for this event'; END IF;
 IF EXISTS(SELECT 1 FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id AND status='confirmed') THEN RAISE EXCEPTION 'You are already registered for this event'; END IF;
 q:=public.quote_ticket_price(t.id,p_code);
 IF q->>'code_error' IS NOT NULL THEN RAISE EXCEPTION '%',q->>'code_error'; END IF;
 IF coalesce(trim(p_code),'')<>'' THEN PERFORM public.redeem_promo_code(p_code,t.id); END IF;
 SELECT * INTO o FROM public.paid_event_orders WHERE user_id=auth.uid() AND event_id=e.id FOR UPDATE;
 IF FOUND THEN
  UPDATE public.paid_event_orders SET ticket_type_id=t.id,form_id='sandbox',amount_cents=round(t.price*100)::integer,status='completed',provider_payment_id=payment_id,verified_at=now(),verification_note='Sandbox test payment' WHERE id=o.id;
 ELSE
  INSERT INTO public.paid_event_orders(user_id,event_id,ticket_type_id,form_id,amount_cents,status,provider_payment_id,verified_at,verification_note)
  VALUES(auth.uid(),e.id,t.id,'sandbox',round(t.price*100)::integer,'completed',payment_id,now(),'Sandbox test payment');
 END IF;
 SELECT id INTO registration_id FROM public.registrations WHERE user_id=auth.uid() AND event_id=e.id AND ticket_type_id=t.id AND status='cancelled' ORDER BY created_at DESC LIMIT 1;
 IF registration_id IS NOT NULL THEN UPDATE public.registrations SET status='confirmed' WHERE id=registration_id;
 ELSE INSERT INTO public.registrations(user_id,event_id,ticket_type_id) VALUES(auth.uid(),e.id,t.id) RETURNING id INTO registration_id; END IF;
 INSERT INTO public.payment_records(user_id,provider_payment_id,purpose,description,amount_cents,currency,status,paid_at,verified_at)
 VALUES(auth.uid(),payment_id,'event',left(e.title||' · '||t.name||CASE WHEN (q->>'code_applied')::boolean OR (q->>'member_discount_cents')::integer>0 THEN ' (discounted)' ELSE '' END,200),(q->>'final_cents')::integer,'USD','completed',now(),now());
 RETURN jsonb_build_object('registration_id',registration_id,'payment_id',payment_id,'charged_cents',(q->>'final_cents')::integer);
END $$;

-- Membership: activates or renews the caller's membership for one billing period.
CREATE OR REPLACE FUNCTION public.sandbox_purchase_membership(p_plan_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pl public.membership_plans; m public.memberships; payment_id text:='sandbox_'||replace(gen_random_uuid()::text,'-',''); period interval; starts timestamptz:=now(); ends timestamptz;
BEGIN
 PERFORM public.assert_payments_sandbox();
 SELECT * INTO pl FROM public.membership_plans WHERE id=p_plan_id AND published AND acquisition_mode='charitystack' AND amount_cents>0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a published paid plan'; END IF;
 period:=CASE pl.billing_period WHEN 'monthly' THEN interval '1 month' ELSE interval '1 year' END;
 SELECT * INTO m FROM public.memberships WHERE user_id=auth.uid() FOR UPDATE;
 IF FOUND AND m.source='complimentary' AND m.status='active' AND m.expires_at>now() THEN RAISE EXCEPTION 'You already have a complimentary membership'; END IF;
 -- Renewing the same active plan extends from the current end date.
 IF FOUND AND m.status='active' AND m.plan_id=pl.id AND m.expires_at>now() THEN starts:=m.starts_at; ends:=m.expires_at+period; ELSE ends:=now()+period; END IF;
 INSERT INTO public.memberships(user_id,plan_id,status,starts_at,expires_at,cancel_at_period_end,source,provider_subscription_id,verified_at)
 VALUES(auth.uid(),pl.id,'active',starts,ends,false,'charitystack',payment_id,now())
 ON CONFLICT (user_id) DO UPDATE SET plan_id=excluded.plan_id,status='active',starts_at=excluded.starts_at,expires_at=excluded.expires_at,cancel_at_period_end=false,source='charitystack',provider_subscription_id=excluded.provider_subscription_id,verified_at=now();
 INSERT INTO public.payment_records(user_id,provider_payment_id,purpose,description,amount_cents,currency,status,paid_at,verified_at)
 VALUES(auth.uid(),payment_id,'membership',left(pl.name||' membership',200),pl.amount_cents,'USD','completed',now(),now());
 RETURN jsonb_build_object('payment_id',payment_id,'expires_at',ends);
END $$;

-- Donation: linked to the campaign so its progress bar and donor report update.
CREATE OR REPLACE FUNCTION public.sandbox_donate(p_campaign_id uuid,p_amount_cents integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record; payment_id text:='sandbox_'||replace(gen_random_uuid()::text,'-','');
BEGIN
 PERFORM public.assert_payments_sandbox();
 IF p_amount_cents IS NULL OR p_amount_cents NOT BETWEEN 100 AND 1000000 THEN RAISE EXCEPTION 'Donations must be between $1 and $10,000'; END IF;
 SELECT d.id,d.name INTO c FROM public.donation_campaigns d WHERE d.id=p_campaign_id AND d.published AND NOT coalesce((to_jsonb(d)->>'archived')::boolean,false);
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not available'; END IF;
 INSERT INTO public.payment_records(user_id,provider_payment_id,purpose,description,amount_cents,currency,status,paid_at,verified_at,campaign_id)
 VALUES(auth.uid(),payment_id,'donation',left('Donation · '||c.name,200),p_amount_cents,'USD','completed',now(),now(),c.id);
 RETURN jsonb_build_object('payment_id',payment_id);
END $$;

-- Approved refunds of sandbox ticket payments are marked refunded automatically (real provider refunds stay manual).
CREATE OR REPLACE FUNCTION public.mark_sandbox_refund() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations;
BEGIN
 IF NEW.status='approved' AND OLD.status='requested' THEN
  SELECT * INTO r FROM public.registrations WHERE id=NEW.registration_id;
  UPDATE public.payment_records SET status='refunded' WHERE user_id=r.user_id AND purpose='event' AND status='completed'
   AND provider_payment_id IN (SELECT provider_payment_id FROM public.paid_event_orders WHERE user_id=r.user_id AND event_id=r.event_id AND provider_payment_id LIKE 'sandbox\_%');
  UPDATE public.paid_event_orders SET status='refunded' WHERE user_id=r.user_id AND event_id=r.event_id AND provider_payment_id LIKE 'sandbox\_%';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS thabaat_sandbox_refund ON public.refund_requests;
CREATE TRIGGER thabaat_sandbox_refund AFTER UPDATE OF status ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.mark_sandbox_refund();

REVOKE ALL ON FUNCTION public.payments_mode(),public.set_payments_mode(text),public.assert_payments_sandbox(),public.sandbox_purchase_ticket(uuid,text),public.sandbox_purchase_membership(uuid),public.sandbox_donate(uuid,integer),public.mark_sandbox_refund() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.payments_mode(),public.set_payments_mode(text),public.sandbox_purchase_ticket(uuid,text),public.sandbox_purchase_membership(uuid),public.sandbox_donate(uuid,integer) TO authenticated;
COMMIT;
