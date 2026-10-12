BEGIN;
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
  SELECT public.event_reserved_seats(p_id) INTO occupied;
  IF p_capacity<occupied THEN RAISE EXCEPTION 'Capacity cannot be below registrations and reserved seats'; END IF;
  UPDATE public.events SET title=trim(p_title),description=p_description,event_date=p_date,location=trim(p_location),capacity=p_capacity WHERE id=p_id;
  -- Existing ticket inventory/prices are preserved; this form only manages event capacity.
  result_id:=p_id;
 END IF;
 RETURN result_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_free_ticket_type(p_event_id uuid,p_id uuid,p_name text,p_description text,p_quantity integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; t public.ticket_types; result_id uuid;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT(coalesce(public.current_staff_role()='admin',false) OR (coalesce(public.current_staff_role()='organizer',false) AND e.created_by=auth.uid())) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Event is unavailable'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 100 OR p_description IS NULL OR length(p_description)>1000 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Enter a ticket name, description and quantity (0–10000)'; END IF;
 IF p_id IS NULL THEN INSERT INTO public.ticket_types(event_id,name,description,price,quantity) VALUES(e.id,trim(p_name),p_description,0,p_quantity) RETURNING id INTO result_id;
 ELSE
 SELECT * INTO t FROM public.ticket_types WHERE id=p_id AND event_id=e.id FOR UPDATE;
 IF NOT FOUND OR t.price<>0 THEN RAISE EXCEPTION 'Only free ticket inventory can be edited here'; END IF;
 IF p_quantity<public.event_reserved_seats(e.id,t.id) THEN RAISE EXCEPTION 'Quantity cannot be below registrations and reserved seats'; END IF;
 UPDATE public.ticket_types SET name=trim(p_name),description=p_description,quantity=p_quantity WHERE id=t.id; result_id:=t.id;
 END IF;
 RETURN result_id;
END $$;
CREATE OR REPLACE FUNCTION public.managed_ticket_types(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT(coalesce(public.current_staff_role()='admin',false) OR (coalesce(public.current_staff_role()='organizer',false) AND EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND created_by=auth.uid()))) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('reserved',public.event_reserved_seats(t.event_id,t.id)) ORDER BY t.name,t.id) FROM public.ticket_types t WHERE event_id=p_event_id),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.save_free_ticket_type(uuid,uuid,text,text,integer),public.managed_ticket_types(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_free_ticket_type(uuid,uuid,text,text,integer),public.managed_ticket_types(uuid) TO authenticated;
COMMIT;
