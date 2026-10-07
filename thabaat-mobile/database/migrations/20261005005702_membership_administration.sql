-- Local only, after membership_billing and events_permissions. Complimentary issuance is not a payment.
BEGIN;
ALTER TABLE public.membership_plans ADD COLUMN acquisition_mode text NOT NULL DEFAULT 'charitystack' CHECK(acquisition_mode IN ('charitystack','complimentary'));
ALTER TABLE public.membership_plans ADD COLUMN revision integer NOT NULL DEFAULT 1;
-- Replace the original published-price/link requirement with an explicit complimentary catalog mode.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.membership_plans'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%published%' AND pg_get_constraintdef(oid) LIKE '%checkout_url%' LOOP
  EXECUTE format('ALTER TABLE public.membership_plans DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.membership_plans ADD CONSTRAINT membership_plans_publication_terms CHECK
 ((acquisition_mode='complimentary' AND amount_cents IS NULL AND checkout_url IS NULL AND billing_period='one_time') OR
 (acquisition_mode='charitystack' AND (NOT published OR (amount_cents IS NOT NULL AND checkout_url IS NOT NULL))));
CREATE TABLE public.membership_admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 target_user_id uuid REFERENCES public.profiles(id), plan_id uuid REFERENCES public.membership_plans(id),
 action text NOT NULL CHECK(action IN ('plan_saved','complimentary_issued','complimentary_revoked')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000), previous_record jsonb, new_record jsonb NOT NULL,
 request_id uuid UNIQUE, request_payload jsonb, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX membership_admin_audit_target_date ON public.membership_admin_audit(target_user_id,recorded_at DESC);
ALTER TABLE public.membership_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_admin_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.membership_admin_audit TO service_role;
CREATE FUNCTION public.admin_membership_catalog() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('in_use',(EXISTS(SELECT 1 FROM public.memberships m WHERE m.plan_id=p.id) OR EXISTS(SELECT 1 FROM public.membership_admin_audit a WHERE a.action IN ('complimentary_issued','complimentary_revoked') AND (a.plan_id=p.id OR a.previous_record->>'plan_id'=p.id::text)))) ORDER BY p.name,p.id) FROM public.membership_plans p),'[]'::jsonb);
END $$;
CREATE FUNCTION public.save_membership_plan(p_id uuid,p_revision integer,p_name text,p_description text,p_benefits text[],p_mode text,p_amount_cents integer,p_period text,p_checkout_url text,p_published boolean,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.membership_plans; saved public.membership_plans;
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 3 AND 120 OR p_description IS NULL OR length(p_description)>4000 OR p_benefits IS NULL OR cardinality(p_benefits)>20 OR EXISTS(SELECT 1 FROM unnest(p_benefits) b WHERE b IS NULL OR length(trim(b)) NOT BETWEEN 1 AND 300) OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 2000 OR p_published IS NULL OR p_mode IS NULL OR p_mode NOT IN ('charitystack','complimentary') OR p_period IS NULL OR p_period NOT IN ('one_time','monthly','annually') THEN RAISE EXCEPTION 'Check plan name, benefits, terms and approval reason'; END IF;
 IF p_published AND (trim(p_description)='' OR cardinality(p_benefits)=0) THEN RAISE EXCEPTION 'Published plans require approved description and benefits'; END IF;
 IF p_mode='complimentary' AND (p_amount_cents IS NOT NULL OR p_checkout_url IS NOT NULL OR p_period<>'one_time') THEN RAISE EXCEPTION 'Complimentary plans have no price, recurring billing or checkout'; END IF;
 IF p_mode='charitystack' AND ((p_amount_cents IS NOT NULL AND p_amount_cents<=0) OR (p_checkout_url IS NOT NULL AND p_checkout_url !~ '^https://(www\.)?charitystack\.com/(donate|attend)/[a-zA-Z0-9-]+/?$') OR (p_published AND (p_amount_cents IS NULL OR p_checkout_url IS NULL))) THEN RAISE EXCEPTION 'Published CharityStack plans require approved price and hosted checkout'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO old FROM public.membership_plans WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF p_revision IS DISTINCT FROM old.revision THEN RAISE EXCEPTION 'Plan changed; refresh before saving'; END IF;
  IF (EXISTS(SELECT 1 FROM public.memberships WHERE plan_id=old.id) OR EXISTS(SELECT 1 FROM public.membership_admin_audit a WHERE a.action IN ('complimentary_issued','complimentary_revoked') AND (a.plan_id=old.id OR a.previous_record->>'plan_id'=old.id::text))) AND
   (old.name,old.description,old.benefits,old.acquisition_mode,old.amount_cents,old.billing_period,old.checkout_url) IS DISTINCT FROM
   (trim(p_name),trim(p_description),p_benefits,p_mode,p_amount_cents,p_period,p_checkout_url) THEN RAISE EXCEPTION 'Plan has membership history; create a new draft to change terms'; END IF;
  UPDATE public.membership_plans SET name=trim(p_name),description=trim(p_description),benefits=p_benefits,acquisition_mode=p_mode,amount_cents=p_amount_cents,billing_period=p_period,checkout_url=p_checkout_url,published=p_published,revision=revision+1 WHERE id=p_id RETURNING * INTO saved;
 ELSE
  INSERT INTO public.membership_plans(name,description,benefits,acquisition_mode,amount_cents,billing_period,checkout_url,published) VALUES(trim(p_name),trim(p_description),p_benefits,p_mode,p_amount_cents,p_period,p_checkout_url,p_published) RETURNING * INTO saved;
 END IF;
 INSERT INTO public.membership_admin_audit(actor_id,plan_id,action,reason,previous_record,new_record) VALUES(auth.uid(),saved.id,'plan_saved',trim(p_reason),CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old) END,to_jsonb(saved));
 RETURN to_jsonb(saved);
END $$;
CREATE FUNCTION public.issue_complimentary_membership(p_user_id uuid,p_plan_id uuid,p_expires_at timestamptz,p_reason text,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.memberships; saved public.memberships; prior public.membership_admin_audit; plan public.membership_plans; payload jsonb;
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_request_id IS NULL OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 2000 OR p_expires_at IS NULL OR p_expires_at<=now() THEN RAISE EXCEPTION 'Choose a future expiry and document the issuance reason'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 payload:=jsonb_build_object('user_id',p_user_id,'plan_id',p_plan_id,'expires_at',p_expires_at,'reason',trim(p_reason));
 SELECT * INTO prior FROM public.membership_admin_audit WHERE request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_id<>auth.uid() OR prior.action<>'complimentary_issued' OR prior.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Issuance request already used for different terms'; END IF;
  RETURN prior.new_record;
 END IF;
 SELECT * INTO plan FROM public.membership_plans WHERE id=p_plan_id FOR UPDATE;
 IF NOT FOUND OR NOT plan.published OR plan.acquisition_mode<>'complimentary' THEN RAISE EXCEPTION 'Select a published complimentary plan'; END IF;
 SELECT * INTO old FROM public.memberships WHERE user_id=p_user_id FOR UPDATE;
 IF old.source='charitystack' AND (old.status IN ('active','past_due') OR old.provider_subscription_id IS NOT NULL) THEN RAISE EXCEPTION 'Provider membership must be reconciled before complimentary issuance'; END IF;
 INSERT INTO public.memberships(user_id,plan_id,status,starts_at,expires_at,cancel_at_period_end,source,provider_subscription_id,verified_at) VALUES(p_user_id,p_plan_id,'active',now(),p_expires_at,false,'complimentary',NULL,now()) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id,status='active',starts_at=excluded.starts_at,expires_at=excluded.expires_at,cancel_at_period_end=false,source='complimentary',provider_subscription_id=NULL,verified_at=excluded.verified_at RETURNING * INTO saved;
 INSERT INTO public.membership_admin_audit(actor_id,target_user_id,plan_id,action,reason,previous_record,new_record,request_id,request_payload) VALUES(auth.uid(),p_user_id,p_plan_id,'complimentary_issued',trim(p_reason),CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old) END,to_jsonb(saved),p_request_id,payload);
 -- No payment record, provider settlement, renewal or revenue is created.
 RETURN to_jsonb(saved);
END $$;
CREATE FUNCTION public.revoke_complimentary_membership(p_user_id uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.memberships; saved public.memberships;
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Document the revocation reason'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 SELECT * INTO old FROM public.memberships WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR old.source<>'complimentary' THEN RAISE EXCEPTION 'Complimentary membership not found'; END IF;
 IF old.status='cancelled' THEN RETURN; END IF;
 UPDATE public.memberships SET status='cancelled' WHERE id=old.id RETURNING * INTO saved;
 INSERT INTO public.membership_admin_audit(actor_id,target_user_id,plan_id,action,reason,previous_record,new_record) VALUES(auth.uid(),p_user_id,old.plan_id,'complimentary_revoked',trim(p_reason),to_jsonb(old),to_jsonb(saved));
END $$;
CREATE FUNCTION public.admin_membership_report(p_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE members jsonb; audit jsonb;
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_search IS NULL OR length(trim(p_search))>200 THEN RAISE EXCEPTION 'Invalid account search'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'full_name',p.full_name,'plan_name',mp.name,'status',m.status,'source',m.source,'starts_at',m.starts_at,'expires_at',m.expires_at,'cancel_at_period_end',m.cancel_at_period_end,'active',m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now()) ORDER BY m.expires_at,m.user_id),'[]'::jsonb) INTO members FROM public.memberships m JOIN public.profiles p ON p.id=m.user_id JOIN public.membership_plans mp ON mp.id=m.plan_id WHERE trim(p_search)='' OR position(lower(trim(p_search)) IN lower(p.full_name))>0 OR p.id::text=trim(p_search);
 SELECT coalesce(jsonb_agg(a ORDER BY a.recorded_at DESC),'[]'::jsonb) INTO audit FROM (SELECT ma.id,ma.target_user_id,ma.plan_id,ma.action,ma.reason,ma.recorded_at,ma.previous_record,ma.new_record,p.full_name AS actor_name FROM public.membership_admin_audit ma JOIN public.profiles p ON p.id=ma.actor_id WHERE trim(p_search)='' OR ma.target_user_id::text=trim(p_search) OR EXISTS(SELECT 1 FROM public.profiles target WHERE target.id=ma.target_user_id AND position(lower(trim(p_search)) IN lower(target.full_name))>0) ORDER BY ma.recorded_at DESC,ma.id DESC LIMIT 100) a;
 RETURN jsonb_build_object('memberships',members,'history',audit,'history_limit',100,'counts',jsonb_build_object('recorded',jsonb_array_length(members),'active', (SELECT count(*) FROM jsonb_array_elements(members) x WHERE (x->>'active')::boolean),'past_due',(SELECT count(*) FROM jsonb_array_elements(members) x WHERE x->>'status'='past_due'),'ending_30_days',(SELECT count(*) FROM jsonb_array_elements(members) x WHERE (x->>'active')::boolean AND (x->>'expires_at')::timestamptz<=now()+interval '30 days')));
END $$;
REVOKE ALL ON FUNCTION public.admin_membership_catalog(),public.save_membership_plan(uuid,integer,text,text,text[],text,integer,text,text,boolean,text),public.issue_complimentary_membership(uuid,uuid,timestamptz,text,uuid),public.revoke_complimentary_membership(uuid,text),public.admin_membership_report(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_membership_catalog(),public.save_membership_plan(uuid,integer,text,text,text[],text,integer,text,text,boolean,text),public.issue_complimentary_membership(uuid,uuid,timestamptz,text,uuid),public.revoke_complimentary_membership(uuid,text),public.admin_membership_report(text) TO authenticated;
COMMIT;
