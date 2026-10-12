-- Local only. Campaign editing never writes or verifies a payment.
BEGIN;
ALTER TABLE public.donation_campaigns ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.donation_campaigns ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.donation_campaigns ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.donation_campaigns(id);
CREATE UNIQUE INDEX IF NOT EXISTS one_featured_campaign ON public.donation_campaigns(featured) WHERE featured AND published AND NOT archived;
CREATE INDEX IF NOT EXISTS donation_payment_campaign_idx ON public.payment_records(campaign_id,paid_at) WHERE purpose='donation';
CREATE TABLE IF NOT EXISTS public.campaign_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES public.profiles(id),campaign_id uuid NOT NULL REFERENCES public.donation_campaigns(id),reason text NOT NULL,previous_record jsonb,new_record jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.campaign_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.campaign_audit TO service_role;
DROP POLICY IF EXISTS campaigns_read ON public.donation_campaigns;
CREATE POLICY campaigns_read ON public.donation_campaigns FOR SELECT TO authenticated USING(published AND NOT archived);
-- A guarded definer is necessary for aggregate donor totals across private payment rows.
CREATE OR REPLACE FUNCTION public.campaign_listing() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(item ORDER BY featured DESC,name,id) FROM (
 SELECT c.id,c.name,c.featured,jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'checkout_url',c.checkout_url,'recurring_available',c.recurring_available,'goal_cents',c.goal_cents,'featured',c.featured,'raised_cents',coalesce((SELECT sum(p.amount_cents) FROM public.payment_records p WHERE p.campaign_id=c.id AND p.purpose='donation' AND p.status='completed' AND p.currency='USD' AND p.paid_at<=now() AND p.verified_at<=now() AND length(trim(p.provider_payment_id))>0),0)) AS item FROM public.donation_campaigns c WHERE c.published AND NOT c.archived
 ) entries),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.admin_campaign_catalog() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.archived,c.name,c.id) FROM public.donation_campaigns c),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.save_campaign(p_id uuid,p_revision integer,p_name text,p_description text,p_checkout_url text,p_recurring boolean,p_goal_cents bigint,p_published boolean,p_featured boolean,p_reason text) RETURNS public.donation_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_record public.donation_campaigns; result public.donation_campaigns;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(29742904);
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 3 AND 150 OR p_description IS NULL OR length(p_description)>5000 OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000 OR p_recurring IS NULL OR p_published IS NULL OR p_featured IS NULL OR (p_goal_cents IS NOT NULL AND p_goal_cents NOT BETWEEN 1 AND 100000000000) THEN RAISE EXCEPTION 'Check campaign name, description, goal and audit reason'; END IF;
 IF p_checkout_url IS NULL OR (p_checkout_url<>'' AND p_checkout_url !~ '^https://(www[.])?charitystack[.]com/donate/[a-zA-Z0-9-]+/?$') OR (p_published AND p_checkout_url='') THEN RAISE EXCEPTION 'Use an approved public CharityStack donation form URL'; END IF;
 IF p_featured AND NOT p_published THEN RAISE EXCEPTION 'Publish a campaign before featuring it'; END IF;
 IF p_id IS NOT NULL THEN
 SELECT * INTO old_record FROM public.donation_campaigns WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR old_record.archived THEN RAISE EXCEPTION 'Campaign is unavailable'; END IF;
 IF p_revision IS DISTINCT FROM old_record.revision THEN RAISE EXCEPTION 'Campaign changed. Refresh before saving'; END IF;
 END IF;
 IF p_featured THEN
 INSERT INTO public.campaign_audit(actor_id,campaign_id,reason,previous_record,new_record) SELECT auth.uid(),c.id,'Featured replaced: '||trim(p_reason),to_jsonb(c),to_jsonb(c)||jsonb_build_object('featured',false,'revision',c.revision+1) FROM public.donation_campaigns c WHERE c.featured AND c.id IS DISTINCT FROM p_id;
 UPDATE public.donation_campaigns SET featured=false,revision=revision+1 WHERE featured AND id IS DISTINCT FROM p_id;
 END IF;
 IF p_id IS NULL THEN
 INSERT INTO public.donation_campaigns(name,description,checkout_url,recurring_available,goal_cents,published,featured) VALUES(trim(p_name),p_description,p_checkout_url,p_recurring,p_goal_cents,p_published,p_featured) RETURNING * INTO result;
 ELSE
 UPDATE public.donation_campaigns SET name=trim(p_name),description=p_description,checkout_url=p_checkout_url,recurring_available=p_recurring,goal_cents=p_goal_cents,published=p_published,featured=p_featured,revision=revision+1 WHERE id=p_id RETURNING * INTO result;
 END IF;
 INSERT INTO public.campaign_audit(actor_id,campaign_id,reason,previous_record,new_record) VALUES(auth.uid(),result.id,trim(p_reason),CASE WHEN p_id IS NULL THEN NULL ELSE to_jsonb(old_record) END,to_jsonb(result));
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.archive_campaign(p_id uuid,p_revision integer,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.donation_campaigns;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(29742904);
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Enter an audit reason (5–1000 characters)'; END IF;
 SELECT * INTO c FROM public.donation_campaigns WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.archived THEN RAISE EXCEPTION 'Campaign is unavailable'; END IF;
 IF c.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Campaign changed. Refresh before archiving'; END IF;
 UPDATE public.donation_campaigns SET archived=true,published=false,featured=false,revision=revision+1 WHERE id=p_id;
 INSERT INTO public.campaign_audit(actor_id,campaign_id,reason,previous_record,new_record) SELECT auth.uid(),id,trim(p_reason),to_jsonb(c),to_jsonb(d) FROM public.donation_campaigns d WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_donation_report(p_before timestamptz DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE records jsonb; total bigint; cutoff timestamptz:=coalesce(p_before,now());
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF cutoff>now() OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'Invalid donation report cutoff or offset'; END IF;
 SELECT count(*) INTO total FROM public.payment_records p WHERE p.purpose='donation' AND p.status='completed' AND p.paid_at<=cutoff AND p.verified_at<=cutoff AND p.currency='USD' AND length(trim(p.provider_payment_id))>0;
 SELECT coalesce(jsonb_agg(item ORDER BY paid_at DESC,id),'[]'::jsonb) INTO records FROM (
 SELECT p.id,p.paid_at,jsonb_build_object('id',p.id,'full_name',u.full_name,'campaign',coalesce(c.name,'Unattributed'),'description',p.description,'amount_cents',p.amount_cents,'currency',p.currency,'paid_at',p.paid_at,'verified_at',p.verified_at) AS item FROM public.payment_records p JOIN public.profiles u ON u.id=p.user_id LEFT JOIN public.donation_campaigns c ON c.id=p.campaign_id WHERE p.purpose='donation' AND p.status='completed' AND p.paid_at<=cutoff AND p.verified_at<=cutoff AND p.currency='USD' AND length(trim(p.provider_payment_id))>0 ORDER BY p.paid_at DESC,p.id OFFSET p_offset LIMIT 200
 ) page;
 RETURN jsonb_build_object('records',records,'total',total,'cutoff',cutoff);
END $$;
REVOKE ALL ON FUNCTION public.campaign_listing(),public.admin_campaign_catalog(),public.save_campaign(uuid,integer,text,text,text,boolean,bigint,boolean,boolean,text),public.archive_campaign(uuid,integer,text),public.admin_donation_report(timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campaign_listing(),public.admin_campaign_catalog(),public.save_campaign(uuid,integer,text,text,text,boolean,bigint,boolean,boolean,text),public.archive_campaign(uuid,integer,text),public.admin_donation_report(timestamptz,integer) TO authenticated;
COMMIT;
