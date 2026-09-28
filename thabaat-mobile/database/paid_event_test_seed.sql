-- STAGING qyxggeyqbebezlolvztf ONLY. Existing $1 test form; no real event admission.
BEGIN;
INSERT INTO public.events(id,title,description,event_date,location,capacity)
VALUES('71000000-0000-4000-8000-000000000001','[STAGING] $1 Paid Access Test',
'Real $1 checkout for an internal app access test, not a real-world event. Use your app checkout reference and account email. Pay only once. A team member must verify the CharityStack payment before your ticket and private access page unlock.',
now()+interval '30 days','In-app test only — no physical venue',1) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.ticket_types(id,event_id,name,price,quantity,description)
VALUES('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','Paid test access',1,1,'One real $1 payment; access after manual verification.') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.paid_event_checkout_configs(ticket_type_id,form_id,enabled)
VALUES('72000000-0000-4000-8000-000000000001','5451350b-cef4-4e59-8240-aa457d4f7c7e',true) ON CONFLICT(ticket_type_id) DO NOTHING;
INSERT INTO public.event_access_details(event_id,access_text)
VALUES('71000000-0000-4000-8000-000000000001','Paid test access unlocked. Your verified payment granted this private event page and a confirmed ticket in My Events. This is a staging demonstration, not admission to a real-world event.') ON CONFLICT(event_id) DO NOTHING;
COMMIT;
