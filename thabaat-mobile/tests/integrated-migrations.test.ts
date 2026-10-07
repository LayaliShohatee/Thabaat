/// <reference types="node" />
import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import {beforeAll,afterAll,it,expect} from 'vitest'
let db:PGlite
const admin='00000000-0000-0000-0000-000000000001',member='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003'
let event:string,ticket:string,plan:string
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT ON storage.objects TO authenticated;`)
 await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'))
 const directory=new URL('../database/migrations/',import.meta.url)
 for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,directory),'utf8'))
 for(const [id,name] of [[admin,'Admin'],[member,'Member'],[other,'Other']])await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,name+'@example.invalid',JSON.stringify({full_name:name})])
 await db.query("INSERT INTO staff_roles VALUES($1,'admin')",[admin])
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated;GRANT SELECT,INSERT ON registrations TO authenticated')
 await as(admin);event=(await db.query<{id:string}>("SELECT save_managed_event(null,'Integrated fixture','',now()+interval '1 hour','Fixture',1) AS id")).rows[0].id
 ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[event])).rows[0].id
 await db.exec('RESET ROLE');plan=(await db.query<{id:string}>("INSERT INTO membership_plans(name,billing_period) VALUES('Synthetic unpublished plan','monthly') RETURNING id")).rows[0].id
},30000)
afterAll(async()=>await db?.close())
it('all local migrations apply together, cancellation/reactivation history and notification queue coexist',async()=>{
 await as(member);await db.query("INSERT INTO notification_preferences(user_id,push_enabled,confirmations) VALUES($1,true,true)",[member])
 const first=(await db.query<{v:{id:string}}>('SELECT reserve_free_event($1,$2) AS v',[event,ticket])).rows[0].v
 await db.query('SELECT cancel_free_registration($1)',[first.id]);const next=(await db.query<{v:{id:string}}>('SELECT reserve_free_event($1,$2) AS v',[event,ticket])).rows[0].v
 expect(next.id).toBe(first.id)
 await db.exec('RESET ROLE');expect((await db.query("SELECT kind FROM thabaat_notifications.outbox WHERE kind='confirmation'")).rows).toHaveLength(2)
})
it('waitlist-held inventory survives owner capacity edits and converts once',async()=>{
 await as(other);await db.query('SELECT join_event_waitlist($1,$2)',[event,ticket])
 await as(member);const row=(await db.query<{id:string}>('SELECT id FROM registrations WHERE event_id=$1',[event])).rows[0];await db.query('SELECT cancel_free_registration($1)',[row.id])
 await as(admin);await db.query("SELECT offer_next_waitlist_seat($1,$2,now()+interval '30 minutes')",[event,ticket])
 await expect(db.query("SELECT save_managed_event($1,'Integrated fixture','',now()+interval '1 hour','Fixture',0)",[event])).rejects.toThrow()
 await as(member);await expect(db.query('SELECT reserve_free_event($1,$2)',[event,ticket])).rejects.toThrow('sold out')
 await as(other);const accepted=(await db.query<{v:{id:string,status:string}}>('SELECT accept_waitlist_offer($1) AS v',[event])).rows[0].v;expect(accepted.status).toBe('confirmed');expect((await db.query<{v:{id:string}}>('SELECT accept_waitlist_offer($1) AS v',[event])).rows[0].v.id).toBe(accepted.id)
})
it('real membership expiry blocks member event reactivation and member ticket check-in',async()=>{
 await db.exec('RESET ROLE');await db.query('UPDATE events SET members_only=true WHERE id=$1',[event]);await db.query("INSERT INTO memberships(user_id,plan_id,status,starts_at,expires_at,source,verified_at) VALUES($1,$2,'active',now()-interval '1 day',now()+interval '1 day','complimentary',now())",[other,plan]);
 await as(other);const reg=(await db.query<{id:string}>('SELECT id FROM registrations WHERE event_id=$1',[event])).rows[0].id
 const code=(await db.query<{v:{token:string}}>('SELECT get_my_ticket($1) AS v',[reg])).rows[0].v.token
 await db.exec('RESET ROLE');await db.query("UPDATE memberships SET expires_at=now()-interval '1 second' WHERE user_id=$1",[other]);await as(admin);await expect(db.query('SELECT check_in_ticket($1,$2)',[event,code])).rejects.toThrow(/membership/i)
 await as(other);await expect(db.query('SELECT get_my_ticket($1)',[reg])).rejects.toThrow(/membership/i)
 await db.query('SELECT cancel_free_registration($1)',[reg]);await expect(db.query('SELECT reserve_free_event($1,$2)',[event,ticket])).rejects.toThrow(/membership/i)
})
