/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest'
let db:PGlite
const one='00000000-0000-0000-0000-000000000001',two='00000000-0000-0000-0000-000000000002',event='10000000-0000-0000-0000-000000000001',ticket='20000000-0000-0000-0000-000000000001'
async function as(id=one){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
const reserve=async()=> (await db.query<{r:{id:string,status:string}}>('SELECT to_jsonb(reserve_free_event($1,$2)) AS r',[event,ticket])).rows[0].r
const cancel=async(id:string)=>(await db.query<{r:{id:string,status:string}}>('SELECT to_jsonb(cancel_free_registration($1)) AS r',[id])).rows[0].r
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20261005003918_registration_lifecycle.sql','migrations/20261005003918_registration_lifecycle.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'one@example.invalid','{}'),($2,'two@example.invalid','{}')",[one,two])
 await db.query("INSERT INTO events(id,title,event_date,location,capacity) VALUES($1,'Fixture',now()+interval '1 day','Venue',1)",[event])
 await db.query("INSERT INTO ticket_types(id,event_id,name,price,quantity) VALUES($1,$2,'Free',0,1)",[ticket,event])
 await db.exec('GRANT SELECT,INSERT ON registrations TO authenticated')
},30000)
beforeEach(async()=>{await db.exec("RESET ROLE; TRUNCATE registration_history,registrations,paid_event_orders; UPDATE events SET capacity=1,archived=false,event_date=now()+interval '1 day'; UPDATE ticket_types SET price=0,quantity=1");await as()})
afterAll(async()=>await db?.close())
it('allocation, cancellation and reactivation preserve one ticket and append history once',async()=>{
 const r=await reserve();expect(await reserve()).toEqual(r)
 expect((await cancel(r.id)).status).toBe('cancelled');expect((await cancel(r.id)).status).toBe('cancelled')
 const again=await reserve();expect(again.id).toBe(r.id);expect(again.status).toBe('confirmed')
 expect((await db.query('SELECT action FROM registration_history ORDER BY created_at,id')).rows.map((r:any)=>r.action).sort()).toEqual(['cancelled','reactivated','registered'])
})
it('released seat can be allocated elsewhere and cannot be overbooked on reactivation',async()=>{const r=await reserve();await cancel(r.id);await as(two);await reserve();await as();await expect(reserve()).rejects.toThrow('sold out')})
it('cannot cancel or view another user history',async()=>{const r=await reserve();await as(two);await expect(cancel(r.id)).rejects.toThrow('not found');expect((await db.query('SELECT * FROM registration_history')).rows).toEqual([])})
it('does not expose generic status mutation or history fabrication',async()=>{const r=await reserve();await expect(db.query("UPDATE registrations SET status='cancelled' WHERE id=$1",[r.id])).rejects.toThrow('permission denied');await expect(db.query("INSERT INTO registration_history(registration_id,user_id,event_id,action) VALUES($1,$2,$3,'cancelled')",[r.id,one,event])).rejects.toThrow('permission denied')})
it('past and archived events cannot reactivate registrations',async()=>{const r=await reserve();await cancel(r.id);await db.exec('RESET ROLE; UPDATE events SET archived=true');await as();await expect(reserve()).rejects.toThrow('unavailable');await db.exec("RESET ROLE; UPDATE events SET archived=false,event_date=now()-interval '1 day'");await as();await expect(reserve()).rejects.toThrow('closed')})
it('cancellation does not reopen past-event admission',async()=>{const r=await reserve();await db.exec("RESET ROLE; UPDATE events SET event_date=now()-interval '1 day'");await as();await expect(cancel(r.id)).rejects.toThrow('closed')})
it('paid tickets cannot use free lifecycle',async()=>{const r=await reserve();await db.exec('RESET ROLE; UPDATE ticket_types SET price=10');await as();await expect(cancel(r.id)).rejects.toThrow('operator review');await expect(reserve()).rejects.toThrow('verified payment')})
it('anonymous callers cannot invoke lifecycle',async()=>{await db.exec('RESET ROLE; SET ROLE anon');await expect(reserve()).rejects.toThrow('permission denied')})
