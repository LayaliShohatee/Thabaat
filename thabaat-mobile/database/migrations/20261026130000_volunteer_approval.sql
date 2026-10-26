-- Volunteer approval: members apply with the in-app volunteer interest form; an admin approves or declines it in
-- Admin → Roles. Approving now gives the Volunteer role (never downgrading an organizer or admin), and only approved
-- team accounts can sign up to volunteer at an event. After 20261026120000_group_registration.
-- Applied to the thabaat-staging development project on 2026-10-26.
BEGIN;
-- Same as 20261005003948 (with the 20261005023000 guard and audit) plus granting the Volunteer role on approval.
CREATE OR REPLACE FUNCTION public.review_volunteer_application(p_user_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('approved','declined') THEN RAISE EXCEPTION 'Invalid application decision'; END IF;
 UPDATE public.volunteer_applications SET status=p_status,updated_at=now() WHERE user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
 INSERT INTO public.volunteer_onboarding_audit(actor_id,user_id,status) VALUES(auth.uid(),p_user_id,p_status);
 -- Declining leaves roles alone; removing an existing role stays an explicit Admin → Roles change.
 IF p_status='approved' AND NOT EXISTS(SELECT 1 FROM public.staff_roles WHERE user_id=p_user_id) THEN
  INSERT INTO public.staff_roles VALUES(p_user_id,'volunteer');
  INSERT INTO public.role_audit(actor_id,target_id,previous_role,new_role) VALUES(auth.uid(),p_user_id,NULL,'volunteer');
 END IF;
END $$;

-- Same as 20261014130000 plus the approval check; organizers and admins stay allowed.
CREATE OR REPLACE FUNCTION public.sign_up_to_volunteer(p_event_id uuid,p_availability text,p_preferred_role text,p_notes text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result text;
BEGIN
 PERFORM public.assert_active_account();
 IF public.current_staff_role() IS NULL THEN RAISE EXCEPTION 'Only approved volunteers can sign up to volunteer at events'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND NOT archived AND event_date>now()) THEN RAISE EXCEPTION 'Volunteer sign-up is closed for this event'; END IF;
 INSERT INTO public.event_volunteer_signups(event_id,user_id,availability,preferred_role,notes) VALUES(p_event_id,auth.uid(),left(trim(coalesce(p_availability,'')),200),left(trim(coalesce(p_preferred_role,'')),200),left(trim(coalesce(p_notes,'')),1000))
 ON CONFLICT(event_id,user_id) DO UPDATE SET availability=excluded.availability,preferred_role=excluded.preferred_role,notes=excluded.notes,
  status=CASE WHEN public.event_volunteer_signups.status='confirmed' THEN 'confirmed' ELSE 'requested' END,updated_at=now()
 RETURNING status INTO result;
 RETURN result;
END $$;
COMMIT;
