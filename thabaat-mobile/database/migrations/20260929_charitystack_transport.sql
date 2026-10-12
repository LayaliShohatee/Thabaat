-- Apply after 20260928_paid_event_test.sql. Server-only transport; no auto-fulfillment.
BEGIN;
ALTER TABLE public.paid_event_checkout_configs
  ADD COLUMN IF NOT EXISTS provider_mode text NOT NULL DEFAULT 'live' CHECK (provider_mode IN ('test','live')),
  ADD COLUMN IF NOT EXISTS provider_ticket_name text;

CREATE TABLE IF NOT EXISTS public.charitystack_checkout_links (
  order_id uuid PRIMARY KEY REFERENCES public.paid_event_orders(id),
  mode text NOT NULL CHECK (mode IN ('test','live')),
  status text NOT NULL CHECK (status IN ('creating','ready','needs_review')),
  provider_link_id text,
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ready' OR (provider_link_id IS NOT NULL AND checkout_url IS NOT NULL)),
  UNIQUE (mode,provider_link_id)
);
CREATE TABLE IF NOT EXISTS public.charitystack_webhook_inbox (
  mode text NOT NULL CHECK (mode IN ('test','live')),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'needs_review' CHECK (status IN ('needs_review','reviewed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(mode,payload_sha256)
);
ALTER TABLE public.charitystack_checkout_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charitystack_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charitystack_checkout_links, public.charitystack_webhook_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.charitystack_checkout_links, public.charitystack_webhook_inbox TO service_role;
-- No authenticated policies: provider payloads can contain donor information.
COMMIT;
