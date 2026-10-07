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
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20260929_events_permissions.sql','migrations/20260929_event_attendees.sql','migrations/20261005004906_rich_event_details.sql','migrations/20261005004906_rich_event_details.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'admin@example.invalid','{}'),($2,'organizer@example.invalid','{}'),($3,'member@example.invalid','{}')",[admin,organizer,member])
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated; GRANT SELECT,INSERT ON registrations TO authenticated')
},30000)
beforeEach(async()=>{await db.exec('RESET ROLE; TRUNCATE memberships,membership_plans,role_audit,staff_roles,registrations,paid_event_orders,event_access_details,paid_event_checkout_configs,ticket_types,events CASCADE');await db.query("INSERT INTO staff_roles VALUES($1,'admin'),($2,'organizer')",[admin,organizer]);await as(member)})
afterAll(async()=>{await db?.close()})

it('saves full details atomically, validates timezone/end time and keeps owner protection',async()=>{
 await as(organizer); const details={address:'123 Test Street',speaker_name:'Test speaker',speaker_bio:'Biography',logistics:'Bring notebook',eligibility:'Adults',faqs:'Parking is free',timezone:'America/Detroit',end_at:new Date(Date.now()+31*86400000).toISOString(),members_only:true,age_min:'18',age_max:'80',audience_gender:'Any',image_url:'https://example.invalid/image.png'};
 const query="SELECT save_event_details(null,'Rich event','Description',now()+interval '30 days','Venue',10,$1) AS id";
 const id=(await db.query<{id:string}>(query,[JSON.stringify(details)])).rows[0].id;
 expect((await db.query('SELECT address,speaker_name,members_only FROM events WHERE id=$1',[id])).rows[0]).toEqual({address:details.address,speaker_name:details.speaker_name,members_only:true});
 await expect(db.query(query,[JSON.stringify({...details,timezone:'Wrong/Zone'})])).rejects.toThrow('timezone');
 await expect(db.query(query,[JSON.stringify({...details,end_at:new Date().toISOString()})])).rejects.toThrow('End time');
 await expect(db.query(query,[JSON.stringify({...details,age_min:'81'})])).rejects.toThrow('Maximum age');
 await expect(db.query(query,[JSON.stringify({...details,age_min:'NaN'})])).rejects.toThrow('Age limits');
 await expect(db.query(query,[JSON.stringify({...details,image_url:'javascript:alert(1)'})])).rejects.toThrow('HTTPS');
 await as(member);await expect(db.query(query,[JSON.stringify(details)])).rejects.toThrow('Organizer');
})
it('denies unverified/expired/overdue membership on direct insert including malicious pending input and reactivation',async()=>{
 await as(organizer);const id=await create();await db.exec('RESET ROLE');await db.query('UPDATE events SET members_only=true WHERE id=$1',[id]);const ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[id])).rows[0].id;
 await as(member);const insert="INSERT INTO registrations(user_id,event_id,ticket_type_id,status) VALUES($1,$2,$3,'pending') RETURNING id";
 await expect(db.query(insert,[member,id,ticket])).rejects.toThrow('membership');
 await db.exec('RESET ROLE');const plan=(await db.query<{id:string}>("INSERT INTO membership_plans(name,billing_period) VALUES('Complimentary','one_time') RETURNING id")).rows[0].id;
 await db.query("INSERT INTO memberships(user_id,plan_id,status,starts_at,expires_at,source,verified_at) VALUES($1,$2,'active',now()-interval '1 day',now()+interval '1 day','complimentary',now())",[member,plan]);
 await as(member);const registration=(await db.query<{id:string}>(insert,[member,id,ticket])).rows[0].id;
 await db.exec('RESET ROLE');await db.query("UPDATE registrations SET status='cancelled' WHERE id=$1",[registration]);await db.query("UPDATE memberships SET status='past_due' WHERE user_id=$1",[member]);
 await expect(db.query("UPDATE registrations SET status='confirmed' WHERE id=$1",[registration])).rejects.toThrow('membership');
 await db.query("UPDATE memberships SET status='active',expires_at=now()-interval '1 hour' WHERE user_id=$1",[member]);await expect(db.query("UPDATE registrations SET status='confirmed' WHERE id=$1",[registration])).rejects.toThrow('membership');
 await db.query("UPDATE memberships SET expires_at=now()+interval '1 day',verified_at=now()+interval '1 day' WHERE user_id=$1",[member]);await expect(db.query("UPDATE registrations SET status='confirmed' WHERE id=$1",[registration])).rejects.toThrow('membership');
})
