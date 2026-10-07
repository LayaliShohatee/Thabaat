/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest'
let db:PGlite
const one='00000000-0000-0000-0000-000000000001',two='00000000-0000-0000-0000-000000000002',event='10000000-0000-0000-0000-000000000001',ticket='20000000-0000-0000-0000-000000000001',admin='00000000-0000-0000-0000-000000000003'
async function as(id=one){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
const reserve=async()=> (await db.query<{r:{id:string,status:string}}>('SELECT to_jsonb(reserve_free_event($1,$2)) AS r',[event,ticket])).rows[0].r
const cancel=async(id:string)=>(await db.query<{r:{id:string,status:string}}>('SELECT to_jsonb(cancel_free_registration($1)) AS r',[id])).rows[0].r
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20261005003918_registration_lifecycle.sql','migrations/20261005004916_event_waitlist.sql','migrations/20261005004916_event_waitlist.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'one@example.invalid','{}'),($2,'two@example.invalid','{}'),($3,'admin@example.invalid','{}')",[one,two,admin])
 await db.query("INSERT INTO events(id,title,event_date,location,capacity) VALUES($1,'Fixture',now()+interval '1 day','Venue',1)",[event])
 await db.query("INSERT INTO ticket_types(id,event_id,name,price,quantity) VALUES($1,$2,'Free',0,1)",[ticket,event])
 await db.query("INSERT INTO staff_roles VALUES($1,'admin')",[admin]);await db.exec('GRANT SELECT,INSERT ON registrations TO authenticated')
},30000)
beforeEach(async()=>{await db.exec("RESET ROLE; TRUNCATE event_waitlist,registration_history,registrations,paid_event_orders; UPDATE events SET capacity=1,archived=false,event_date=now()+interval '1 day'; UPDATE ticket_types SET price=0,quantity=1");await as()})
afterAll(async()=>await db?.close())

const join=()=>db.query('SELECT join_event_waitlist($1,$2)',[event,ticket])
const offer=()=>db.query("SELECT offer_next_waitlist_seat($1,$2,now()+interval '1 hour')",[event,ticket])
const accept=()=>db.query<{r:{id:string,status:string}}>('SELECT accept_waitlist_offer($1) AS r',[event])
it('waitlist does not reserve until manager offers, acceptance is idempotent',async()=>{
 const r=await reserve();await as(two);await join();await join();await as(one);await cancel(r.id);await as(admin);await offer();await as(two);const result=await accept();expect(result.rows[0].r.status).toBe('confirmed');expect((await accept()).rows[0].r.id).toBe(result.rows[0].r.id)
 expect((await db.query('SELECT status FROM event_waitlist')).rows).toEqual([{status:'accepted'}])
})
it('an active seat offer blocks direct insert and normal reservation',async()=>{
 const r=await reserve();await as(two);await join();await as(one);await cancel(r.id);await as(admin);await offer();await as(one)
 await expect(reserve()).rejects.toThrow('sold out')
 await expect(db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[one,event,ticket])).rejects.toThrow('sold out')
})
it('expired offers release inventory and cannot be accepted',async()=>{
 const r=await reserve();await as(two);await join();await as(one);await cancel(r.id);await as(admin);await offer();await db.exec("RESET ROLE; UPDATE event_waitlist SET offer_expires_at=now()-interval '1 minute'");await as(two);await expect(accept()).rejects.toThrow('No valid seat');await as(one);await reserve()
})
it('joining without sellout is rejected, leaving releases an offer without registration',async()=>{
 await expect(join()).rejects.toThrow('seat is available');const r=await reserve();await as(two);await join();await as(one);await cancel(r.id);await as(admin);await offer();await as(two);await db.query('SELECT leave_event_waitlist($1)',[event]);await db.query('SELECT leave_event_waitlist($1)',[event]);expect((await db.query('SELECT * FROM registrations')).rows).toEqual([]);await as(one);await reserve()
})
it('nonmanagers cannot discover or offer seats; other user entries are hidden',async()=>{await reserve();await as(two);await join();await expect(offer()).rejects.toThrow('not permitted');await expect(db.query('SELECT manage_event_waitlist($1)',[event])).rejects.toThrow('not permitted');await as(one);expect((await db.query('SELECT * FROM event_waitlist')).rows).toEqual([])})
it('past offers and unknown free tickets are rejected',async()=>{await as(admin);await expect(db.query("SELECT offer_next_waitlist_seat($1,$2,now()-interval '1 hour')",[event,ticket])).rejects.toThrow('expiry');await as(two);await expect(db.query('SELECT join_event_waitlist($1,$2)',[event,event])).rejects.toThrow('free ticket')})
it('manager cannot offer beyond inventory or skip existing registration admission',async()=>{await reserve();await as(two);await join();await as(admin);await expect(offer()).rejects.toThrow('No seat');await as(one);await expect(join()).rejects.toThrow('Already registered')})
