/// <reference types="node" />
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {expect,it} from 'vitest'
it('narrow legacy anon proposal preserves signed-in RPCs, signup trigger and read policies',async()=>{
 const db=await PGlite.create(),sql=(file:string)=>readFile(new URL('../database/'+file,import.meta.url),'utf8')
 try{
  await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;`)
  for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql'])await db.exec(await sql(file))
  expect((await db.query(`SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef AND has_function_privilege('anon',oid,'EXECUTE')`)).rows).toHaveLength(12)
  const permissions=()=>db.query(`SELECT oid::regprocedure::text AS signature,has_function_privilege('authenticated',oid,'EXECUTE') AS allowed FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef ORDER BY signature`)
  const policies=()=>db.query(`SELECT policyname,roles,qual,with_check FROM pg_policies ORDER BY tablename,policyname`)
  const before=(await permissions()).rows,beforePolicies=(await policies()).rows
  await db.exec(await sql('proposals/revoke_legacy_anonymous_execute.sql'));await db.exec(await sql('proposals/revoke_legacy_anonymous_execute.sql'))
  expect((await db.query(`SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef AND has_function_privilege('anon',oid,'EXECUTE')`)).rows).toHaveLength(0)
  expect((await permissions()).rows).toEqual(before);expect((await policies()).rows).toEqual(beforePolicies)
  const id='00000000-0000-4000-8000-000000000001'
  await db.query(`INSERT INTO auth.users VALUES($1,'synthetic@example.invalid','{"full_name":"Synthetic"}')`,[id])
  expect((await db.query(`SELECT full_name FROM profiles WHERE id=$1`,[id])).rows[0]).toEqual({full_name:'Synthetic'})
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec('SET ROLE authenticated')
  expect((await db.query<{permissions:{user_id:string}}>('SELECT my_permissions() AS permissions')).rows[0].permissions.user_id).toBe(id)
  await db.exec("RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);SET ROLE anon")
  await expect(db.query('SELECT my_permissions()')).rejects.toThrow('permission denied')
  await expect(db.query('SELECT sync_auth_profile()')).rejects.toThrow('permission denied')
 }finally{await db.close()}
},30000)
it('proposal preserves unrelated public content and skips absent legacy signatures',async()=>{
 const db=await PGlite.create()
 try{
  await db.exec(`CREATE ROLE anon;CREATE FUNCTION public.approved_public_content() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT 'reviewed'::text $$;GRANT EXECUTE ON FUNCTION public.approved_public_content() TO anon;`)
  await db.exec(await readFile(new URL('../database/proposals/revoke_legacy_anonymous_execute.sql',import.meta.url),'utf8'))
  expect((await db.query<{allowed:boolean}>(`SELECT has_function_privilege('anon','public.approved_public_content()','EXECUTE') AS allowed`)).rows[0].allowed).toBe(true)
 }finally{await db.close()}
},30000)
