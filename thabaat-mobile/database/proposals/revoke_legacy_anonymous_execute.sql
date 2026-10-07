-- REVIEW PROPOSAL ONLY: outside migrations, never auto-applied.
-- Exact app-owned legacy signatures whose source already revokes PUBLIC execution.
-- CREATE OR REPLACE preserves explicit anon ACLs; REVOKE PUBLIC does not remove them.
-- Preserve authenticated/service_role grants, table/RLS policies, triggers and bootstrap.
-- Read anonymous_function_audit.sql first. Absent/non-definer signatures are skipped.
BEGIN;
DO $$
DECLARE signature text;target regprocedure;
BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.sync_auth_profile()',
  'public.validate_free_registration()',
  'public.begin_internal_payment_check()',
  'public.begin_paid_event_checkout(uuid)',
  'public.has_verified_event_payment(uuid,uuid,uuid)',
  'public.current_staff_role()',
  'public.my_permissions()',
  'public.search_role_accounts(text)',
  'public.set_staff_role(uuid,text)',
  'public.save_managed_event(uuid,text,text,timestamptz,text,integer)',
  'public.archive_managed_event(uuid)',
  'public.reject_archived_event_reservation()'
 ] LOOP
  target:=pg_catalog.to_regprocedure(signature);
  IF target IS NOT NULL AND EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=target AND prosecdef) THEN
   EXECUTE pg_catalog.format('REVOKE EXECUTE ON FUNCTION %s FROM anon',target);
  END IF;
 END LOOP;
END $$;
COMMIT;
-- No blanket schema/function/default-privilege change. PUBLIC was revoked in source.
-- If audit shows restored PUBLIC execution, stop and review that exact ACL separately.
