/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll,beforeAll,beforeEach,expect,it } from 'vitest'
let db:PGlite,event:string,ticket:string,registration:string
const admin='00000000-0000-0000-0000-000000000001',owner='00000000-0000-0000-0000-000000000002',volunteer='00000000-0000-0000-0000-000000000003',member='00000000-0000-0000-0000-000000000004'
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
async function value<T>(sql:string,params:unknown[]=[]){return (await db.query<{v:T}>(sql,params)).rows[0].v}
beforeAll(async()=>{
 db=await PGlite.create();await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20260929_event_attendees.sql','migrations/20261005003918_registration_lifecycle.sql','migrations/20261005003948_staff_volunteer_reporting.sql','migrations/20261005004731_ticket_checkin.sql','migrations/20261005004916_event_waitlist.sql','migrations/20261005005640_free_ticket_inventory.sql','migrations/20261012120000_backlog_completion.sql','migrations/20261012120200_refunds_discounts.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated;GRANT INSERT,SELECT ON registrations TO authenticated');
 for(const [id,name] of [[admin,'Admin'],[owner,'Owner'],[volunteer,'Helper'],[member,'Member']])await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,name+'@example.invalid',JSON.stringify({full_name:name})])
},30000)
beforeEach(async()=>{
 await db.exec('RESET ROLE;TRUNCATE promo_codes,refund_requests,memberships,membership_plans,event_no_shows,volunteer_assignments,staff_roles,registrations,ticket_types,events CASCADE')
 await db.query("INSERT INTO staff_roles VALUES($1,'admin'),($2,'organizer'),($3,'volunteer')",[admin,owner,volunteer])
 await as(owner);event=await value<string>("SELECT save_managed_event(null,'Owned','',now()+interval '1 day','Venue',10) AS v")
 ticket=await value<string>('SELECT id AS v FROM ticket_types WHERE event_id=$1',[event])
 await as(member);registration=await value<string>('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3) RETURNING id AS v',[member,event,ticket])
})
afterAll(async()=>db?.close())

it('organizers set ticket categories; early bird needs a future cutoff and closed sales block booking',async()=>{
 await as(member);await expect(db.query("SELECT set_ticket_type_category($1,'vip',null)",[ticket])).rejects.toThrow('not permitted')
 await as(owner);await expect(db.query("SELECT set_ticket_type_category($1,'early_bird',null)",[ticket])).rejects.toThrow('Early bird')
 await expect(db.query("SELECT set_ticket_type_category($1,'balcony',null)",[ticket])).rejects.toThrow('valid ticket category')
 await db.query("SELECT set_ticket_type_category($1,'early_bird',now()+interval '1 hour')",[ticket])
 expect((await db.query<{category:string}>('SELECT category FROM ticket_types WHERE id=$1',[ticket])).rows[0].category).toBe('early_bird')
 await db.exec('RESET ROLE');await db.query("UPDATE ticket_types SET sale_ends_at=now()-interval '1 minute' WHERE id=$1",[ticket]);await db.query("UPDATE registrations SET status='cancelled' WHERE id=$1",[registration])
 await expect(db.query("UPDATE registrations SET status='confirmed' WHERE id=$1",[registration])).rejects.toThrow('Sales for this ticket have ended')
})

it('attendee list includes ticket category and optional self-reported demographics',async()=>{
 await db.exec('RESET ROLE');await db.query("UPDATE profiles SET gender='female',birth_year=extract(year FROM now())::int-30 WHERE id=$1",[member])
 await as(owner);const list=await value<any>('SELECT get_event_attendees($1,0) AS v',[event])
 expect(list.attendees[0]).toMatchObject({gender:'female',age:30,ticket_category:'general'})
 await as(member);await expect(db.query('SELECT get_event_attendees($1,0)',[event])).rejects.toThrow('not permitted')
})

it('no-shows are marked only after the event starts, never for checked-in tickets, and cleared by check-in',async()=>{
 await as(owner);await expect(db.query('SELECT set_no_show($1,true)',[registration])).rejects.toThrow('after the event starts')
 await db.exec('RESET ROLE');await db.query("UPDATE events SET event_date=now()-interval '5 minutes' WHERE id=$1",[event])
 await as(volunteer);await expect(db.query('SELECT set_no_show($1,true)',[registration])).rejects.toThrow('not permitted')
 await as(owner);await db.query('SELECT set_no_show($1,true)',[registration])
 let report=await value<any>('SELECT event_attendance_report($1) AS v',[event]);expect(report.no_shows).toBe(1);expect(report.attendees[0].no_show).toBe(true)
 await db.exec('RESET ROLE');await db.query('INSERT INTO event_checkins(registration_id,event_id,checked_in_by) VALUES($1,$2,$3)',[registration,event,owner])
 await as(owner);report=await value<any>('SELECT event_attendance_report($1) AS v',[event]);expect(report.no_shows).toBe(0)
 await expect(db.query('SELECT set_no_show($1,true)',[registration])).rejects.toThrow('Checked-in')
 await expect(db.query('SELECT * FROM event_no_shows')).rejects.toThrow('permission denied')
})

async function paidRegistration(){
 await db.exec('RESET ROLE')
 const paid=await value<string>("INSERT INTO ticket_types(event_id,name,price,quantity) VALUES($1,'Paid',20,10) RETURNING id AS v",[event])
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[admin])
 await db.exec("SET session_replication_role=replica")
 const reg=await value<string>("INSERT INTO registrations(user_id,event_id,ticket_type_id,status) VALUES($1,$2,$3,'confirmed') RETURNING id AS v",[admin,event,paid])
 await db.exec("SET session_replication_role=origin")
 return {paid,reg}
}

it('refunds are requested by the ticket owner before the deadline and approved by event managers',async()=>{
 const {reg}=await paidRegistration()
 await as(member);await expect(db.query("SELECT request_refund($1,'')",[reg])).rejects.toThrow('not found')
 await as(member);await expect(db.query("SELECT request_refund($1,'')",[registration])).rejects.toThrow('Free tickets')
 await as(owner);await db.query("SELECT set_refund_deadline($1,now()-interval '1 minute')",[event])
 await as(admin);await expect(db.query("SELECT request_refund($1,'Sick')",[reg])).rejects.toThrow('deadline')
 await as(owner);await db.query('SELECT set_refund_deadline($1,null)',[event])
 await as(admin);const id=await value<string>("SELECT request_refund($1,'Sick') AS v",[reg])
 await expect(db.query("SELECT request_refund($1,'Again')",[reg])).rejects.toThrow('already open')
 await as(member);await expect(db.query('SELECT review_refund_request($1,true,null)',[id])).rejects.toThrow('not permitted')
 await as(owner);expect((await value<any[]>('SELECT list_refund_requests($1) AS v',[event]))[0]).toMatchObject({status:'requested',reason:'Sick'})
 await db.query("SELECT review_refund_request($1,true,'Refunded in CharityStack')",[id])
 await db.exec('RESET ROLE');expect(await value<string>('SELECT status AS v FROM registrations WHERE id=$1',[reg])).toBe('cancelled')
})

it('discount codes respect event, expiry and limits; member discounts apply first',async()=>{
 const {paid}=await paidRegistration()
 await as(owner);await expect(db.query("SELECT save_promo_code(null,null,'SITE10',10,null,null,null,true)")).rejects.toThrow('administrators')
 await expect(db.query("SELECT save_promo_code(null,$1,'BAD CODE',10,null,null,null,true)",[event])).rejects.toThrow('letters')
 await db.query("SELECT save_promo_code(null,$1,'half',50,null,1,null,true)",[event])
 await as(member);let quote=await value<any>("SELECT quote_ticket_price($1,'HALF') AS v",[paid])
 expect(quote).toMatchObject({base_cents:2000,code_discount_cents:1000,final_cents:1000,code_applied:true})
 expect((await value<any>("SELECT quote_ticket_price($1,'NOPE') AS v",[paid])).code_error).toBe('This code is not valid')
 await db.query("SELECT redeem_promo_code('half',$1)",[paid])
 await expect(db.query("SELECT redeem_promo_code('HALF',$1)",[paid])).rejects.toThrow('no longer')
 expect((await value<any>("SELECT quote_ticket_price($1,'HALF') AS v",[paid])).code_error).toBe('This code has reached its limit')
 await db.exec('RESET ROLE')
 const plan=await value<string>("INSERT INTO membership_plans(name,amount_cents,billing_period,ticket_discount_percent) VALUES('Member',1000,'annually',25) RETURNING id AS v")
 await db.query("INSERT INTO memberships(user_id,plan_id,status,starts_at,expires_at,source,verified_at) VALUES($1,$2,'active',now()-interval '1 day',now()+interval '1 year','complimentary',now()-interval '1 day')",[member,plan])
 await as(member);quote=await value<any>("SELECT quote_ticket_price($1,'') AS v",[paid])
 expect(quote).toMatchObject({member_discount_percent:25,member_discount_cents:500,final_cents:1500})
 await expect(db.query('SELECT * FROM promo_codes')).rejects.toThrow('permission denied')
})
