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
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20260929_events_permissions.sql','migrations/20260929_event_attendees.sql','migrations/20260929_event_attendees.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'admin@example.invalid','{}'),($2,'organizer@example.invalid','{}'),($3,'member@example.invalid','{}')",[admin,organizer,member])
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated; GRANT SELECT,INSERT ON registrations TO authenticated')
},30000)
beforeEach(async()=>{await db.exec('RESET ROLE; TRUNCATE role_audit,staff_roles,registrations,paid_event_orders,event_access_details,paid_event_checkout_configs,ticket_types,events CASCADE');await db.query("INSERT INTO staff_roles VALUES($1,'admin'),($2,'organizer')",[admin,organizer]);await as(member)})
afterAll(async()=>{await db?.close()})
it('reports ordinary users without staff capabilities',async()=>expect((await db.query<{v:unknown}>('SELECT my_permissions() AS v')).rows[0].v).toMatchObject({staff_role:null,can_manage_events:false,can_manage_roles:false,paid_member:false}))
it('denies self-promotion, account discovery and direct role writes',async()=>{
 await expect(db.query("SELECT set_staff_role($1,'admin')",[member])).rejects.toThrow('Administrator required')
 await expect(db.query("SELECT * FROM search_role_accounts('admin')")).rejects.toThrow('Administrator required')
 await expect(db.query("INSERT INTO staff_roles VALUES($1,'admin')",[member])).rejects.toThrow(/permission denied/)
})
it('only admins can assign staff roles and writes an audit record',async()=>{await as(admin);await db.query("SELECT set_staff_role($1,'volunteer')",[member]);await db.exec('RESET ROLE');expect((await db.query('SELECT actor_id,target_id,new_role FROM role_audit')).rows).toEqual([{actor_id:admin,target_id:member,new_role:'volunteer'}])})
it('cannot remove last admin or assign a Paid role',async()=>{await as(admin);await expect(db.query('SELECT set_staff_role($1,null)',[admin])).rejects.toThrow('last administrator');await expect(db.query("SELECT set_staff_role($1,'paid')",[member])).rejects.toThrow('Invalid staff role')})
it('ordinary users and volunteers cannot create events',async()=>{await expect(create()).rejects.toThrow('Organizer');await db.exec('RESET ROLE');await db.query("INSERT INTO staff_roles VALUES($1,'volunteer')",[member]);await as(member);await expect(create()).rejects.toThrow('Organizer')})
it('organizer creates an owned event and a matching free ticket atomically',async()=>{await as(organizer);const id=await create();expect((await db.query('SELECT created_by,capacity FROM events WHERE id=$1',[id])).rows).toEqual([{created_by:organizer,capacity:10}]);expect((await db.query('SELECT price,quantity FROM ticket_types WHERE event_id=$1',[id])).rows).toEqual([{price:'0.00',quantity:10}]);await create(id,20)})
it('organizer cannot edit or archive events owned by another account',async()=>{await as(admin);const id=await create();await as(organizer);await expect(create(id)).rejects.toThrow('not permitted');await expect(db.query('SELECT archive_managed_event($1)',[id])).rejects.toThrow('not permitted')})
it('even admins cannot bypass validated event writes through the table',async()=>{await as(admin);await expect(db.query("INSERT INTO events(title,event_date,location) VALUES('Bypass',now(),'x')")).rejects.toThrow(/permission denied/)})
it('validates dates and capacity on the server',async()=>{await as(organizer);await expect(create(null,0)).rejects.toThrow('Check title');await expect(db.query("SELECT save_managed_event(null,'Past event','',now()-interval '1 day','Here',10)")).rejects.toThrow('Check title')})
it('blocks registration after archive even through direct API insert',async()=>{await as(organizer);const id=await create();const ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[id])).rows[0].id;await db.query('SELECT archive_managed_event($1)',[id]);await as(member);await expect(db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[member,id,ticket])).rejects.toThrow('archived')})
it('cannot archive a booked event or reduce capacity below registrations',async()=>{await as(organizer);const id=await create();const ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[id])).rows[0].id;await as(member);await db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[member,id,ticket]);await as(admin);await db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[admin,id,ticket]);await expect(create(id,1)).rejects.toThrow('Capacity cannot');await expect(db.query('SELECT archive_managed_event($1)',[id])).rejects.toThrow('Resolve registrations')})
it('anonymous users cannot invoke management functions',async()=>{await db.exec('RESET ROLE; SET ROLE anon');await expect(db.query('SELECT my_permissions()')).rejects.toThrow(/permission denied/)})

async function attendeeEvent() {
 await as(organizer); const id=await create(); const ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[id])).rows[0].id
 await as(member); await db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[member,id,ticket]); return id
}
it('owner and admin see attendee names, tickets and totals without contact details',async()=>{
 const id=await attendeeEvent()
 for(const who of [organizer,admin]) {await as(who);const result=(await db.query<{v:{attendees:unknown[];counts:unknown;capacity:number}}>('SELECT get_event_attendees($1) AS v',[id])).rows[0].v
 expect(result).toMatchObject({counts:{total:1,confirmed:1,pending:0,cancelled:0},capacity:10,reserved:0})
 expect(result.attendees[0]).toMatchObject({ticket_name:'General admission',status:'confirmed'})
 expect(result.attendees[0]).not.toHaveProperty('email');expect(result.attendees[0]).not.toHaveProperty('user_id')}
})
it('member, volunteer and a different organizer cannot access attendees',async()=>{
 const id=await attendeeEvent()
 await expect(db.query('SELECT get_event_attendees($1)',[id])).rejects.toThrow('not permitted')
 for(const role of ['volunteer','organizer']){await db.exec('RESET ROLE');await db.query("INSERT INTO staff_roles VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role",[member,role]);await as(member);await expect(db.query('SELECT get_event_attendees($1)',[id])).rejects.toThrow('not permitted')}
 await db.exec('RESET ROLE; SET ROLE anon');await expect(db.query('SELECT get_event_attendees($1)',[id])).rejects.toThrow(/permission denied/)
})
it('attendee totals separate cancelled registrations and validate page offsets',async()=>{
 const id=await attendeeEvent();await db.exec('RESET ROLE');await db.query("UPDATE registrations SET status='cancelled' WHERE event_id=$1",[id]);await as(organizer)
 expect((await db.query<{v:unknown}>('SELECT get_event_attendees($1) AS v',[id])).rows[0].v).toMatchObject({counts:{total:1,confirmed:0,cancelled:1}})
 await expect(db.query('SELECT get_event_attendees($1,-1)',[id])).rejects.toThrow('Invalid page')
 await expect(db.query('SELECT get_event_attendees($1,null)',[id])).rejects.toThrow('Invalid page')
 await expect(db.query("SELECT get_event_attendees('ffffffff-ffff-ffff-ffff-ffffffffffff')")).rejects.toThrow('not permitted')
})
it('attendee pages are bounded, ordered, and preserve total counts',async()=>{
 await as(organizer);const id=await create(null,100);const ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[id])).rows[0].id
 await db.exec('RESET ROLE')
 await db.exec("INSERT INTO auth.users SELECT ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'attendee'||n||'@example.invalid','{}'::jsonb FROM generate_series(1,51) n")
 for(let n=1;n<=51;n++){const user='10000000-0000-0000-0000-'+String(n).padStart(12,'0');await as(user);await db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[user,id,ticket])}await as(organizer)
 const page=async(offset:number)=>(await db.query<{v:{attendees:{registration_id:string}[];counts:{total:number}}}>('SELECT get_event_attendees($1,$2) AS v',[id,offset])).rows[0].v
 const first=await page(0),second=await page(50)
 expect(first.attendees).toHaveLength(50);expect(second.attendees).toHaveLength(1);expect(second.counts.total).toBe(51)
 expect(new Set([...first.attendees,...second.attendees].map(r=>r.registration_id)).size).toBe(51)
})
