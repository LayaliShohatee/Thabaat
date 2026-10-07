-- READ ONLY: approved staging catalog, before reviewing any REVOKE.
-- Includes PUBLIC/inherited execution grants; no auth/storage/platform helpers changed.
SELECT n.nspname AS schema_name,p.proname AS function_name,
 pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
 pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,p.prosecdef,p.proconfig,
 pg_catalog.has_schema_privilege('anon',n.oid,'USAGE') AS anon_schema_usage,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,p.proacl,
 EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgfoid=p.oid AND NOT t.tgisinternal) AS used_by_trigger
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosecdef AND n.nspname IN ('public','private','thabaat_notifications')
ORDER BY n.nspname,p.proname,identity_arguments;
