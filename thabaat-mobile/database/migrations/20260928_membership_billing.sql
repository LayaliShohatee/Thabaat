-- Staging first. No prices, checkout forms, or paid entitlements are invented.
BEGIN;
CREATE TABLE IF NOT EXISTS public.membership_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 description text NOT NULL DEFAULT '', benefits text[] NOT NULL DEFAULT '{}',
 amount_cents integer CHECK (amount_cents > 0), currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
 billing_period text NOT NULL CHECK (billing_period IN ('one_time','monthly','annually')),
 checkout_url text, published boolean NOT NULL DEFAULT false,
 CHECK (NOT published OR (amount_cents IS NOT NULL AND checkout_url IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
 status text NOT NULL CHECK (status IN ('active','past_due','expired','cancelled')),
 starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 cancel_at_period_end boolean NOT NULL DEFAULT false,
 source text NOT NULL CHECK (source IN ('charitystack','complimentary')),
 provider_subscription_id text UNIQUE, verified_at timestamptz NOT NULL,
 CHECK (expires_at > starts_at), UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS public.donation_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 description text NOT NULL DEFAULT '', checkout_url text NOT NULL,
 recurring_available boolean NOT NULL DEFAULT false,
 goal_cents bigint CHECK (goal_cents > 0), raised_cents bigint NOT NULL DEFAULT 0 CHECK (raised_cents >= 0),
 published boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.payment_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 provider_payment_id text NOT NULL UNIQUE,
 purpose text NOT NULL CHECK (purpose IN ('membership','donation','event')),
 description text NOT NULL, amount_cents integer NOT NULL CHECK (amount_cents >= 0),
 currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
 status text NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
 paid_at timestamptz NOT NULL, verified_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_records_user_date ON public.payment_records(user_id,paid_at DESC);
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_plans_read ON public.membership_plans;
-- A former plan remains readable only to its member, even after it is unpublished.
CREATE POLICY membership_plans_read ON public.membership_plans FOR SELECT TO authenticated USING
 (published OR EXISTS (SELECT 1 FROM public.memberships m WHERE m.plan_id = membership_plans.id AND m.user_id = auth.uid()));
DROP POLICY IF EXISTS memberships_read_self ON public.memberships;
CREATE POLICY memberships_read_self ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS campaigns_read ON public.donation_campaigns;
CREATE POLICY campaigns_read ON public.donation_campaigns FOR SELECT TO authenticated USING (published);
DROP POLICY IF EXISTS payments_read_self ON public.payment_records;
CREATE POLICY payments_read_self ON public.payment_records FOR SELECT TO authenticated USING (user_id = auth.uid());
-- No client write policies: a browser callback cannot grant membership or mark a payment paid.
REVOKE ALL ON public.membership_plans, public.memberships, public.donation_campaigns, public.payment_records FROM anon, authenticated;
GRANT SELECT ON public.membership_plans, public.memberships, public.donation_campaigns, public.payment_records TO authenticated;
GRANT ALL ON public.membership_plans, public.memberships, public.donation_campaigns, public.payment_records TO service_role;
COMMIT;

BEGIN;
CREATE TABLE IF NOT EXISTS public.checkout_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 form_id text NOT NULL,
 expected_amount_cents integer NOT NULL CHECK (expected_amount_cents > 0),
 currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
 provider_payment_id text UNIQUE, verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, form_id),
 CHECK (status = 'pending' OR (provider_payment_id IS NOT NULL AND verified_at IS NOT NULL))
);
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkout_attempts_read_self ON public.checkout_attempts;
CREATE POLICY checkout_attempts_read_self ON public.checkout_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.checkout_attempts FROM anon, authenticated;
GRANT SELECT ON public.checkout_attempts TO authenticated;
GRANT ALL ON public.checkout_attempts TO service_role;
-- App-side record only. Does not charge or verify payment. Reuses the internal test attempt.
CREATE OR REPLACE FUNCTION public.begin_internal_payment_check() RETURNS public.checkout_attempts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE attempt public.checkout_attempts;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 INSERT INTO public.checkout_attempts(user_id, form_id, expected_amount_cents)
 VALUES(auth.uid(), '5451350b-cef4-4e59-8240-aa457d4f7c7e', 100)
 ON CONFLICT(user_id, form_id) DO NOTHING;
 SELECT * INTO attempt FROM public.checkout_attempts
 WHERE user_id = auth.uid() AND form_id = '5451350b-cef4-4e59-8240-aa457d4f7c7e';
 RETURN attempt;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_internal_payment_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_internal_payment_check() TO authenticated;
COMMIT;
