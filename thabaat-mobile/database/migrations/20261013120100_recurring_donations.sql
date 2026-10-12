-- Recurring (monthly) donations in test-payment mode (backlog #97). A pledge records its first gift immediately; the
-- backend scheduler calls process_due_donation_pledges() to record each later monthly gift. Requires 20261013120000_payment_sandbox.
BEGIN;
CREATE TABLE IF NOT EXISTS public.donation_pledges(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL REFERENCES public.donation_campaigns(id),
 amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 100 AND 1000000),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
 next_charge_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz
);
CREATE INDEX IF NOT EXISTS donation_pledges_due ON public.donation_pledges(next_charge_at) WHERE status='active';
ALTER TABLE public.donation_pledges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.donation_pledges FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sandbox_start_monthly_donation(p_campaign_id uuid,p_amount_cents integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pledge_id uuid;
BEGIN
 PERFORM public.sandbox_donate(p_campaign_id,p_amount_cents); -- validates mode, account, campaign and amount; records the first gift
 IF EXISTS(SELECT 1 FROM public.donation_pledges WHERE user_id=auth.uid() AND campaign_id=p_campaign_id AND status='active') THEN RAISE EXCEPTION 'You already give monthly to this campaign'; END IF;
 INSERT INTO public.donation_pledges(user_id,campaign_id,amount_cents,next_charge_at) VALUES(auth.uid(),p_campaign_id,p_amount_cents,now()+interval '1 month') RETURNING id INTO pledge_id;
 RETURN pledge_id;
END $$;
CREATE OR REPLACE FUNCTION public.cancel_monthly_donation(p_pledge_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.donation_pledges SET status='cancelled',cancelled_at=now() WHERE id=p_pledge_id AND user_id=auth.uid() AND status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'Monthly gift not found'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.my_monthly_donations() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'campaign_id',p.campaign_id,'campaign',c.name,'amount_cents',p.amount_cents,'next_charge_at',p.next_charge_at) ORDER BY p.created_at),'[]'::jsonb)
 FROM public.donation_pledges p JOIN public.donation_campaigns c ON c.id=p.campaign_id WHERE p.user_id=auth.uid() AND p.status='active'
$$;
-- Service scheduler: records each due monthly gift once (test mode only) and advances the pledge.
CREATE OR REPLACE FUNCTION public.process_due_donation_pledges() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.donation_pledges; c record; total integer:=0;
BEGIN
 IF public.payments_mode()<>'sandbox' THEN RETURN 0; END IF;
 FOR p IN SELECT * FROM public.donation_pledges WHERE status='active' AND next_charge_at<=now() ORDER BY next_charge_at FOR UPDATE SKIP LOCKED LIMIT 200 LOOP
  SELECT d.id,d.name INTO c FROM public.donation_campaigns d WHERE d.id=p.campaign_id AND d.published AND NOT coalesce((to_jsonb(d)->>'archived')::boolean,false);
  IF NOT FOUND THEN UPDATE public.donation_pledges SET status='cancelled',cancelled_at=now() WHERE id=p.id; CONTINUE; END IF;
  INSERT INTO public.payment_records(user_id,provider_payment_id,purpose,description,amount_cents,currency,status,paid_at,verified_at,campaign_id)
  VALUES(p.user_id,'sandbox_'||replace(gen_random_uuid()::text,'-',''),'donation',left('Monthly donation · '||c.name,200),p.amount_cents,'USD','completed',now(),now(),c.id);
  UPDATE public.donation_pledges SET next_charge_at=next_charge_at+interval '1 month' WHERE id=p.id;
  total:=total+1;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.sandbox_start_monthly_donation(uuid,integer),public.cancel_monthly_donation(uuid),public.my_monthly_donations(),public.process_due_donation_pledges() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_start_monthly_donation(uuid,integer),public.cancel_monthly_donation(uuid),public.my_monthly_donations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_donation_pledges() TO service_role;
COMMIT;
