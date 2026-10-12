-- Apply after paid-event and membership migrations, staging first.
BEGIN;
CREATE TABLE IF NOT EXISTS public.staff_roles (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('volunteer','organizer','admin'))
);
CREATE TABLE IF NOT EXISTS public.role_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 target_id uuid NOT NULL REFERENCES public.profiles(id), previous_role text, new_role text,
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_roles,public.role_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.staff_roles,public.role_audit TO service_role;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
-- All app writes go through narrow owner/admin-checked functions, regardless of old RLS policies.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.events,public.ticket_types FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.current_staff_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.staff_roles WHERE user_id=auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.my_permissions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 r:=public.current_staff_role();
 RETURN jsonb_build_object('user_id',auth.uid(),'staff_role',r,'can_manage_events',coalesce(r IN ('organizer','admin'),false),'can_manage_roles',coalesce(r='admin',false),'paid_member',EXISTS(SELECT 1 FROM public.memberships WHERE user_id=auth.uid() AND status='active' AND starts_at<=now() AND expires_at>now() AND verified_at<=now()));
END $$;

CREATE OR REPLACE FUNCTION public.search_role_accounts(p_search text)
RETURNS TABLE(user_id uuid,full_name text,email text,staff_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_search IS NULL OR length(trim(p_search))<3 OR length(p_search)>100 THEN RAISE EXCEPTION 'Enter at least 3 characters'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email,r.role FROM public.profiles p LEFT JOIN public.staff_roles r ON r.user_id=p.id
 WHERE position(lower(trim(p_search)) IN lower(p.email))>0 OR position(lower(trim(p_search)) IN lower(p.full_name))>0 ORDER BY p.email LIMIT 20;
END $$;
CREATE OR REPLACE FUNCTION public.set_staff_role(p_user_id uuid,p_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_role text;
BEGIN
 -- Serialize role changes so two administrators cannot remove the last admin concurrently.
 PERFORM pg_catalog.pg_advisory_xact_lock(29742901);
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_role IS NOT NULL AND p_role NOT IN ('volunteer','organizer','admin') THEN RAISE EXCEPTION 'Invalid staff role'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'Account not found'; END IF;
 SELECT role INTO old_role FROM public.staff_roles WHERE user_id=p_user_id;
 IF old_role='admin' AND p_role IS DISTINCT FROM 'admin' AND (SELECT count(*) FROM public.staff_roles WHERE role='admin')<=1 THEN RAISE EXCEPTION 'Cannot remove the last administrator'; END IF;
 IF old_role IS NOT DISTINCT FROM p_role THEN RETURN; END IF;
 IF p_role IS NULL THEN DELETE FROM public.staff_roles WHERE user_id=p_user_id;
 ELSE INSERT INTO public.staff_roles VALUES(p_user_id,p_role) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role; END IF;
 INSERT INTO public.role_audit(actor_id,target_id,previous_role,new_role) VALUES(auth.uid(),p_user_id,old_role,p_role);
END $$;

CREATE OR REPLACE FUNCTION public.save_managed_event(p_id uuid,p_title text,p_description text,p_date timestamptz,p_location text,p_capacity integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; e public.events; result_id uuid; occupied integer;
BEGIN
 r:=public.current_staff_role();
 IF r IS NULL OR r NOT IN ('organizer','admin') THEN RAISE EXCEPTION 'Organizer or administrator required'; END IF;
 IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 3 AND 150 OR p_location IS NULL OR length(trim(p_location)) NOT BETWEEN 2 AND 250 OR p_description IS NULL OR length(p_description)>5000 OR p_date IS NULL OR p_date<=now() OR p_capacity IS NULL OR p_capacity NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Check title, location, future date and capacity (1–10000)'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.events(title,description,event_date,location,capacity,created_by) VALUES(trim(p_title),p_description,p_date,trim(p_location),p_capacity,auth.uid()) RETURNING id INTO result_id;
  INSERT INTO public.ticket_types(event_id,name,price,quantity) VALUES(result_id,'General admission',0,p_capacity);
 ELSE
  SELECT * INTO e FROM public.events WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR (r<>'admin' AND e.created_by IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
  IF e.archived THEN RAISE EXCEPTION 'Archived events cannot be edited'; END IF;
  SELECT (SELECT count(*) FROM public.registrations WHERE event_id=p_id AND status<>'cancelled')+(SELECT count(*) FROM public.paid_event_orders WHERE event_id=p_id AND status='pending') INTO occupied;
  IF p_capacity<occupied THEN RAISE EXCEPTION 'Capacity cannot be below registrations and reserved seats'; END IF;
  UPDATE public.events SET title=trim(p_title),description=p_description,event_date=p_date,location=trim(p_location),capacity=p_capacity WHERE id=p_id;
  -- Existing ticket inventory/prices are preserved; this form only manages event capacity.
  result_id:=p_id;
 END IF;
 RETURN result_id;
END $$;
CREATE OR REPLACE FUNCTION public.archive_managed_event(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; r text;
BEGIN
 r:=public.current_staff_role();
 SELECT * INTO e FROM public.events WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r IS NULL OR r NOT IN ('organizer','admin') OR (r<>'admin' AND e.created_by IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF EXISTS(SELECT 1 FROM public.registrations WHERE event_id=p_id AND status<>'cancelled') OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE event_id=p_id AND status='pending') THEN RAISE EXCEPTION 'Resolve registrations and reserved seats before archiving'; END IF;
 UPDATE public.events SET archived=true WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION public.reject_archived_event_reservation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE is_archived boolean;
BEGIN
 SELECT archived INTO is_archived FROM public.events WHERE id=NEW.event_id FOR UPDATE;
 IF is_archived THEN RAISE EXCEPTION 'Registration is closed for this archived event'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS thabaat_reject_archived ON public.registrations;
CREATE TRIGGER thabaat_reject_archived BEFORE INSERT ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.reject_archived_event_reservation();
DROP TRIGGER IF EXISTS thabaat_reject_archived_order ON public.paid_event_orders;
CREATE TRIGGER thabaat_reject_archived_order BEFORE INSERT ON public.paid_event_orders FOR EACH ROW EXECUTE FUNCTION public.reject_archived_event_reservation();
REVOKE ALL ON FUNCTION public.current_staff_role(),public.my_permissions(),public.search_role_accounts(text),public.set_staff_role(uuid,text),public.save_managed_event(uuid,text,text,timestamptz,text,integer),public.archive_managed_event(uuid),public.reject_archived_event_reservation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_permissions(),public.search_role_accounts(text),public.set_staff_role(uuid,text),public.save_managed_event(uuid,text,text,timestamptz,text,integer),public.archive_managed_event(uuid) TO authenticated;
COMMIT;
