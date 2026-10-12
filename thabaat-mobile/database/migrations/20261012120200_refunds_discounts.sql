-- Backlog completion (October 12): refund requests (#76/#77), discount codes (#87) and member ticket discounts (#59).
-- Money movement stays with CharityStack; these records drive staff review and the displayed price.
-- Apply only after explicit approval, after 20261012120000_backlog_completion.
BEGIN;

-- #77 Refund deadline per event and attendee refund requests reviewed by event managers.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS refund_deadline timestamptz;
CREATE TABLE IF NOT EXISTS public.refund_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK (length(reason)<=1000),
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','declined')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid, reviewed_at timestamptz, review_note text CHECK (review_note IS NULL OR length(review_note)<=1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_open ON public.refund_requests(registration_id) WHERE status='requested';
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.refund_requests TO authenticated;
DROP POLICY IF EXISTS thabaat_refund_requests_own ON public.refund_requests;
CREATE POLICY thabaat_refund_requests_own ON public.refund_requests FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.set_refund_deadline(p_event_id uuid,p_deadline timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF p_deadline IS NOT NULL AND p_deadline>e.event_date THEN RAISE EXCEPTION 'Refund deadline must be before the event starts'; END IF;
 UPDATE public.events SET refund_deadline=p_deadline WHERE id=e.id;
END $$;
CREATE OR REPLACE FUNCTION public.request_refund(p_registration_id uuid,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations; e public.events; t public.ticket_types; result_id uuid;
BEGIN
 IF pg_catalog.to_regprocedure('public.assert_active_account()') IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 SELECT * INTO r FROM public.registrations WHERE id=p_registration_id FOR UPDATE;
 IF NOT FOUND OR r.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Registration not found'; END IF;
 SELECT * INTO e FROM public.events WHERE id=r.event_id;
 SELECT * INTO t FROM public.ticket_types WHERE id=r.ticket_type_id;
 IF r.status<>'confirmed' THEN RAISE EXCEPTION 'Only confirmed tickets can be refunded'; END IF;
 IF t.price<=0 THEN RAISE EXCEPTION 'Free tickets can be cancelled instead'; END IF;
 IF EXISTS(SELECT 1 FROM public.event_checkins WHERE registration_id=r.id) THEN RAISE EXCEPTION 'Checked-in tickets cannot be refunded'; END IF;
 IF now()>=coalesce(e.refund_deadline,e.event_date) THEN RAISE EXCEPTION 'The refund deadline for this event has passed'; END IF;
 IF EXISTS(SELECT 1 FROM public.refund_requests WHERE registration_id=r.id AND status='requested') THEN RAISE EXCEPTION 'A refund request is already open for this ticket'; END IF;
 INSERT INTO public.refund_requests(registration_id,event_id,user_id,reason) VALUES(r.id,r.event_id,r.user_id,coalesce(left(trim(p_reason),1000),'')) RETURNING id INTO result_id;
 RETURN result_id;
END $$;
CREATE OR REPLACE FUNCTION public.review_refund_request(p_request_id uuid,p_approve boolean,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.refund_requests;
BEGIN
 SELECT * INTO q FROM public.refund_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_staff_event(q.event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF q.status<>'requested' THEN RAISE EXCEPTION 'This refund request was already reviewed'; END IF;
 UPDATE public.refund_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(left(trim(coalesce(p_note,'')),1000),'') WHERE id=q.id;
 -- An approved refund releases the seat; the payment itself is returned in CharityStack.
 IF p_approve THEN UPDATE public.registrations SET status='cancelled' WHERE id=q.registration_id AND status='confirmed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.list_refund_requests(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_event_id IS NULL THEN
  IF NOT coalesce(public.current_staff_role()='admin',false) THEN RAISE EXCEPTION 'Administrator required'; END IF;
 ELSIF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'event_id',q.event_id,'event_title',e.title,'full_name',p.full_name,'ticket_name',t.name,'price',t.price,'reason',q.reason,'status',q.status,'requested_at',q.requested_at,'reviewed_at',q.reviewed_at,'review_note',q.review_note) ORDER BY q.status<>'requested',q.requested_at DESC)
  FROM public.refund_requests q JOIN public.events e ON e.id=q.event_id JOIN public.registrations r ON r.id=q.registration_id JOIN public.profiles p ON p.id=q.user_id JOIN public.ticket_types t ON t.id=r.ticket_type_id
  WHERE p_event_id IS NULL OR q.event_id=p_event_id),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.set_refund_deadline(uuid,timestamptz),public.request_refund(uuid,text),public.review_refund_request(uuid,boolean,text),public.list_refund_requests(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_refund_deadline(uuid,timestamptz),public.request_refund(uuid,text),public.review_refund_request(uuid,boolean,text),public.list_refund_requests(uuid) TO authenticated;

-- #87 Discount codes (event-specific or site-wide) with limits and expiry.
CREATE TABLE IF NOT EXISTS public.promo_codes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
 code text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{3,32}$'),
 percent_off integer CHECK (percent_off BETWEEN 1 AND 100),
 amount_off_cents integer CHECK (amount_off_cents BETWEEN 1 AND 1000000),
 max_uses integer CHECK (max_uses BETWEEN 1 AND 100000),
 uses integer NOT NULL DEFAULT 0 CHECK (uses>=0),
 expires_at timestamptz,
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((percent_off IS NULL)<>(amount_off_cents IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_unique ON public.promo_codes(code);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_codes FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.save_promo_code(p_id uuid,p_event_id uuid,p_code text,p_percent_off integer,p_amount_off_cents integer,p_max_uses integer,p_expires_at timestamptz,p_active boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing public.promo_codes; normalized text:=upper(trim(coalesce(p_code,''))); result_id uuid;
BEGIN
 IF p_event_id IS NULL THEN
  IF NOT coalesce(public.current_staff_role()='admin',false) THEN RAISE EXCEPTION 'Only administrators can create site-wide codes'; END IF;
 ELSIF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF normalized !~ '^[A-Z0-9_-]{3,32}$' THEN RAISE EXCEPTION 'Codes use 3–32 letters, numbers, dashes or underscores'; END IF;
 IF (p_percent_off IS NULL)=(p_amount_off_cents IS NULL) THEN RAISE EXCEPTION 'Choose a percent or a fixed amount off'; END IF;
 IF p_expires_at IS NOT NULL AND p_expires_at<=now() THEN RAISE EXCEPTION 'Expiry must be in the future'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.promo_codes(event_id,code,percent_off,amount_off_cents,max_uses,expires_at,active,created_by) VALUES(p_event_id,normalized,p_percent_off,p_amount_off_cents,p_max_uses,p_expires_at,coalesce(p_active,true),auth.uid()) RETURNING id INTO result_id;
 ELSE
  SELECT * INTO existing FROM public.promo_codes WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR existing.event_id IS DISTINCT FROM p_event_id THEN RAISE EXCEPTION 'Discount code not found'; END IF;
  IF p_max_uses IS NOT NULL AND p_max_uses<existing.uses THEN RAISE EXCEPTION 'Limit cannot be below uses so far'; END IF;
  UPDATE public.promo_codes SET code=normalized,percent_off=p_percent_off,amount_off_cents=p_amount_off_cents,max_uses=p_max_uses,expires_at=p_expires_at,active=coalesce(p_active,true) WHERE id=p_id;
  result_id:=p_id;
 END IF;
 RETURN result_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'That code is already in use';
END $$;
CREATE OR REPLACE FUNCTION public.list_promo_codes(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_staff_event(p_event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(c)-'created_by' ORDER BY c.created_at) FROM public.promo_codes c WHERE c.event_id=p_event_id OR c.event_id IS NULL),'[]'::jsonb);
END $$;

-- #59 Member ticket discount, configured per membership plan.
ALTER TABLE public.membership_plans ADD COLUMN IF NOT EXISTS ticket_discount_percent integer NOT NULL DEFAULT 0 CHECK (ticket_discount_percent BETWEEN 0 AND 100);

-- Price quote shown before checkout: member discount first, then the code. Never below zero.
CREATE OR REPLACE FUNCTION public.quote_ticket_price(p_ticket_id uuid,p_code text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.ticket_types; c public.promo_codes; base integer; member_pct integer:=0; member_off integer:=0; code_off integer:=0; code_error text:=null; normalized text:=upper(trim(coalesce(p_code,'')));
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to see your price'; END IF;
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
 base:=round(t.price*100)::integer;
 SELECT coalesce(max(pl.ticket_discount_percent),0) INTO member_pct FROM public.memberships m JOIN public.membership_plans pl ON pl.id=m.plan_id
  WHERE m.user_id=auth.uid() AND m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now();
 member_off:=floor(base*member_pct/100.0)::integer;
 IF normalized<>'' THEN
  SELECT * INTO c FROM public.promo_codes WHERE code=normalized;
  IF NOT FOUND OR NOT c.active THEN code_error:='This code is not valid';
  ELSIF c.event_id IS NOT NULL AND c.event_id<>t.event_id THEN code_error:='This code is for a different event';
  ELSIF c.expires_at IS NOT NULL AND c.expires_at<=now() THEN code_error:='This code has expired';
  ELSIF c.max_uses IS NOT NULL AND c.uses>=c.max_uses THEN code_error:='This code has reached its limit';
  ELSE code_off:=least(base-member_off,coalesce(c.amount_off_cents,floor((base-member_off)*c.percent_off/100.0)::integer));
  END IF;
 END IF;
 RETURN jsonb_build_object('base_cents',base,'member_discount_percent',member_pct,'member_discount_cents',member_off,'code_discount_cents',code_off,'final_cents',greatest(0,base-member_off-code_off),'code_applied',code_off>0,'code_error',code_error);
END $$;
-- Counts one use when a paid order is created with the code; refuses when the limit is reached.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text,p_ticket_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.promo_codes; t public.ticket_types;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_id;
 SELECT * INTO c FROM public.promo_codes WHERE code=upper(trim(coalesce(p_code,''))) FOR UPDATE;
 IF NOT FOUND OR NOT c.active OR (c.event_id IS NOT NULL AND c.event_id IS DISTINCT FROM t.event_id) OR (c.expires_at IS NOT NULL AND c.expires_at<=now()) OR (c.max_uses IS NOT NULL AND c.uses>=c.max_uses) THEN RAISE EXCEPTION 'This code can no longer be used'; END IF;
 UPDATE public.promo_codes SET uses=uses+1 WHERE id=c.id;
END $$;
REVOKE ALL ON FUNCTION public.save_promo_code(uuid,uuid,text,integer,integer,integer,timestamptz,boolean),public.list_promo_codes(uuid),public.quote_ticket_price(uuid,text),public.redeem_promo_code(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_promo_code(uuid,uuid,text,integer,integer,integer,timestamptz,boolean),public.list_promo_codes(uuid),public.quote_ticket_price(uuid,text),public.redeem_promo_code(text,uuid) TO authenticated;

COMMIT;
