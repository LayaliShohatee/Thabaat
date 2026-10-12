/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest'
let db:PGlite
const admin='00000000-0000-0000-0000-000000000001',organizer='00000000-0000-0000-0000-000000000002',member='00000000-0000-0000-0000-000000000003'
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
async function create(id:string|null=null,capacity=10){return (await db.query<{id:string}>("SELECT save_managed_event($1,'Local event','Test description',now()+interval '30 days','Test venue',$2) AS id",[id,capacity])).rows[0].id}
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20260929_events_permissions.sql','migrations/20260929_event_attendees.sql','migrations/20261005004906_rich_event_details.sql','migrations/20261005003918_registration_lifecycle.sql','migrations/20261005004916_event_waitlist.sql','migrations/20261005005640_free_ticket_inventory.sql','migrations/20261005005640_free_ticket_inventory.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'admin@example.invalid','{}'),($2,'organizer@example.invalid','{}'),($3,'member@example.invalid','{}')",[admin,organizer,member])
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated; GRANT SELECT,INSERT ON registrations TO authenticated')
},30000)
beforeEach(async()=>{await db.exec('RESET ROLE; TRUNCATE memberships,membership_plans,role_audit,staff_roles,registrations,paid_event_orders,event_access_details,paid_event_checkout_configs,ticket_types,events CASCADE');await db.query("INSERT INTO staff_roles VALUES($1,'admin'),($2,'organizer')",[admin,organizer]);await as(member)})
afterAll(async()=>{await db?.close()})


it('adds a free ticket only for event owner/admin and rejects changing a paid ticket',async()=>{
 await as(organizer);const event=await create();const ticket=(await db.query<{id:string}>("SELECT save_free_ticket_type($1,null,'Students','Approved free ticket',3) AS id",[event])).rows[0].id;
 expect((await db.query('SELECT name,price,quantity FROM ticket_types WHERE id=$1',[ticket])).rows[0]).toEqual({name:'Students',price:'0.00',quantity:3});
 await as(member);await expect(db.query("SELECT save_free_ticket_type($1,$2,'Bypass','',3)",[event,ticket])).rejects.toThrow('management');await expect(db.query('SELECT managed_ticket_types($1)',[event])).rejects.toThrow('management');
 await db.exec('RESET ROLE');await db.query('UPDATE ticket_types SET price=1 WHERE id=$1',[ticket]);await as(organizer);await expect(db.query("SELECT save_free_ticket_type($1,$2,'Paid change','',3)",[event,ticket])).rejects.toThrow('Only free');
})
it('preserves waitlist offered seats when reducing ticket inventory or total capacity',async()=>{
 await as(organizer);const event=await create();const ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[event])).rows[0].id;
 await db.exec('RESET ROLE');await db.query("INSERT INTO event_waitlist(user_id,event_id,ticket_type_id,status,offer_expires_at) VALUES($1,$2,$3,'offered',now()+interval '1 hour')",[member,event,ticket]);await as(organizer);
 await expect(db.query("SELECT save_free_ticket_type($1,$2,'Free','',0)",[event,ticket])).rejects.toThrow('reserved seats');
 await db.exec('RESET ROLE');await db.query('UPDATE events SET capacity=1 WHERE id=$1',[event]);await db.query("INSERT INTO paid_event_orders(user_id,event_id,ticket_type_id,form_id,amount_cents,status) VALUES($1,$2,$3,'synthetic-form',100,'pending')",[organizer,event,ticket]);await as(organizer);
 await expect(create(event,1)).rejects.toThrow('Capacity');
})
