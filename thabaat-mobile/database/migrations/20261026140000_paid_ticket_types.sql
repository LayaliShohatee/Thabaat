-- Organizers set a ticket price in the ticket editor. Same rules as save_free_ticket_type (20261005005640, with the
-- 20261005023000 guard) plus a price from $0 to $10,000 in whole cents. Paid tickets are bought through the payments
-- flow (test payments only until a provider is connected). A price is locked once anyone has booked or bought the
-- ticket, because orders, payments and refund requests rely on it. save_free_ticket_type stays for older app builds.
-- After 20261026130000_volunteer_approval.
-- Applied to the thabaat-staging development project on 2026-10-26.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_ticket_type(p_event_id uuid,p_id uuid,p_name text,p_description text,p_quantity integer,p_price numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events; t public.ticket_types; result_id uuid;
BEGIN
 PERFORM public.assert_active_account();
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT(coalesce(public.current_staff_role()='admin',false) OR (coalesce(public.current_staff_role()='organizer',false) AND e.created_by=auth.uid())) THEN RAISE EXCEPTION 'Event management not permitted'; END IF;
 IF e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Event is unavailable'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 100 OR p_description IS NULL OR length(p_description)>1000 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Enter a ticket name, description and quantity (0–10000)'; END IF;
 IF p_price IS NULL OR p_price<0 OR p_price>10000 OR p_price<>round(p_price,2) THEN RAISE EXCEPTION 'Enter a price from $0 to $10,000 (up to 2 decimal places)'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.ticket_types(event_id,name,description,price,quantity) VALUES(e.id,trim(p_name),p_description,p_price,p_quantity) RETURNING id INTO result_id;
 ELSE
  SELECT * INTO t FROM public.ticket_types WHERE id=p_id AND event_id=e.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found for this event'; END IF;
  IF p_price<>t.price AND (EXISTS(SELECT 1 FROM public.registrations WHERE ticket_type_id=t.id) OR EXISTS(SELECT 1 FROM public.paid_event_orders WHERE ticket_type_id=t.id)) THEN
   RAISE EXCEPTION 'The price can’t change after people have booked or bought this ticket. Add a new ticket type instead.';
  END IF;
  IF p_quantity<public.event_reserved_seats(e.id,t.id) THEN RAISE EXCEPTION 'Quantity cannot be below registrations and reserved seats'; END IF;
  UPDATE public.ticket_types SET name=trim(p_name),description=p_description,quantity=p_quantity,price=p_price WHERE id=t.id; result_id:=t.id;
 END IF;
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.save_ticket_type(uuid,uuid,text,text,integer,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_ticket_type(uuid,uuid,text,text,integer,numeric) TO authenticated;
COMMIT;
