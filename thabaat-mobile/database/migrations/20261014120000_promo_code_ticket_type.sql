-- Client request: a coupon can apply to one ticket type (e.g. "Women's tickets 21+").
-- Applied to the thabaat-staging test project on 2026-10-14 (user approved test-database changes).
BEGIN;
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS ticket_type_id uuid REFERENCES public.ticket_types(id) ON DELETE SET NULL;

-- Sets or clears which ticket type an event code applies to. The ticket must belong to the code's event.
CREATE OR REPLACE FUNCTION public.set_promo_code_ticket_type(p_code_id uuid,p_ticket_type_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.promo_codes;
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 SELECT * INTO c FROM public.promo_codes WHERE id=p_code_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Discount code not found'; END IF;
 IF c.event_id IS NULL THEN RAISE EXCEPTION 'Site-wide codes cannot be limited to one ticket type'; END IF;
 IF NOT public.can_manage_staff_event(c.event_id) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF p_ticket_type_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ticket_types WHERE id=p_ticket_type_id AND event_id=c.event_id) THEN RAISE EXCEPTION 'That ticket type belongs to a different event'; END IF;
 UPDATE public.promo_codes SET ticket_type_id=p_ticket_type_id WHERE id=p_code_id;
END $$;

-- Same as the live versions (20261012120200 plus the suspended-account guard), plus the ticket type check.
CREATE OR REPLACE FUNCTION public.quote_ticket_price(p_ticket_id uuid,p_code text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.ticket_types; c public.promo_codes; base integer; member_pct integer:=0; member_off integer:=0; code_off integer:=0; code_error text:=null; normalized text:=upper(trim(coalesce(p_code,'')));
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
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
  ELSIF c.ticket_type_id IS NOT NULL AND c.ticket_type_id<>t.id THEN code_error:='This code is for a different ticket type';
  ELSIF c.expires_at IS NOT NULL AND c.expires_at<=now() THEN code_error:='This code has expired';
  ELSIF c.max_uses IS NOT NULL AND c.uses>=c.max_uses THEN code_error:='This code has reached its limit';
  ELSE code_off:=least(base-member_off,coalesce(c.amount_off_cents,floor((base-member_off)*c.percent_off/100.0)::integer));
  END IF;
 END IF;
 RETURN jsonb_build_object('base_cents',base,'member_discount_percent',member_pct,'member_discount_cents',member_off,'code_discount_cents',code_off,'final_cents',greatest(0,base-member_off-code_off),'code_applied',code_off>0,'code_error',code_error);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text,p_ticket_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.promo_codes; t public.ticket_types;
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_id;
 SELECT * INTO c FROM public.promo_codes WHERE code=upper(trim(coalesce(p_code,''))) FOR UPDATE;
 IF NOT FOUND OR NOT c.active OR (c.event_id IS NOT NULL AND c.event_id IS DISTINCT FROM t.event_id) OR (c.ticket_type_id IS NOT NULL AND c.ticket_type_id IS DISTINCT FROM t.id) OR (c.expires_at IS NOT NULL AND c.expires_at<=now()) OR (c.max_uses IS NOT NULL AND c.uses>=c.max_uses) THEN RAISE EXCEPTION 'This code can no longer be used'; END IF;
 UPDATE public.promo_codes SET uses=uses+1 WHERE id=c.id;
END $$;

REVOKE ALL ON FUNCTION public.set_promo_code_ticket_type(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_promo_code_ticket_type(uuid,uuid) TO authenticated;
COMMIT;
