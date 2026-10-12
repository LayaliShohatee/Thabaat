/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll,beforeAll,beforeEach,expect,it } from 'vitest'
let db:PGlite,event:string,plan:string,otherPlan:string
const admin='00000000-0000-0000-0000-000000000001',owner='00000000-0000-0000-0000-000000000002',volunteer='00000000-0000-0000-0000-000000000003',member='00000000-0000-0000-0000-000000000004'
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
async function value<T>(sql:string,params:unknown[]=[]){return (await db.query<{v:T}>(sql,params)).rows[0].v}
beforeAll(async()=>{
 db=await PGlite.create();await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20261005003918_registration_lifecycle.sql','migrations/20261005003948_staff_volunteer_reporting.sql','migrations/20261005004111_notification_preferences_outbox.sql','migrations/20261005004906_rich_event_details.sql','migrations/20261005005702_membership_administration.sql','migrations/20261012120200_refunds_discounts.sql','migrations/20261012120300_membership_public_volunteers.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 for(const [id,name] of [[admin,'Admin'],[owner,'Owner'],[volunteer,'Helper'],[member,'Member']])await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,name+'@example.invalid',JSON.stringify({full_name:name})])
},30000)
beforeEach(async()=>{
 await db.exec('RESET ROLE;TRUNCATE membership_change_requests,memberships,membership_plans,volunteer_onboarding,volunteer_assignments,volunteer_applications,staff_roles,thabaat_notifications.outbox,thabaat_public_preview.publications,events CASCADE')
 await db.query("INSERT INTO staff_roles VALUES($1,'admin'),($2,'organizer')",[admin,owner])
 plan=await value<string>("INSERT INTO membership_plans(name,amount_cents,billing_period,checkout_url,published) VALUES('Monthly',1000,'monthly','https://example.invalid/m',true) RETURNING id AS v")
 otherPlan=await value<string>("INSERT INTO membership_plans(name,amount_cents,billing_period,checkout_url,published) VALUES('Annual',10000,'annually','https://example.invalid/a',true) RETURNING id AS v")
 await db.query("INSERT INTO memberships(user_id,plan_id,status,starts_at,expires_at,source,verified_at) VALUES($1,$2,'active',now()-interval '1 day',now()+interval '30 days','charitystack',now()-interval '1 day')",[member,plan])
 await as(owner);event=await value<string>("SELECT save_managed_event(null,'Open day','',now()+interval '3 days','Hall',50) AS v")
})
afterAll(async()=>db?.close())

it('members request plan changes and renewal cancellation; only admins complete them',async()=>{
 await as(member);await expect(db.query("SELECT request_membership_change('change_plan',$1)",[plan])).rejects.toThrow('different published plan')
 const id=await value<string>("SELECT request_membership_change('change_plan',$1) AS v",[otherPlan])
 await expect(db.query("SELECT request_membership_change('cancel_renewal',null)")).rejects.toThrow('already have')
 await expect(db.query('SELECT review_membership_change($1,true)',[id])).rejects.toThrow('Administrator')
 await as(admin);expect((await value<any[]>('SELECT list_membership_change_requests() AS v'))[0]).toMatchObject({kind:'change_plan',current_plan:'Monthly',target_plan:'Annual'})
 await db.query('SELECT review_membership_change($1,true)',[id])
 await db.exec('RESET ROLE');expect(await value<string>('SELECT plan_id::text AS v FROM memberships WHERE user_id=$1',[member])).toBe(otherPlan)
 await as(member);const cancel=await value<string>("SELECT request_membership_change('cancel_renewal',null) AS v")
 await as(admin);await db.query('SELECT review_membership_change($1,true)',[cancel])
 await db.exec('RESET ROLE');expect(await value<boolean>('SELECT cancel_at_period_end AS v FROM memberships WHERE user_id=$1',[member])).toBe(true)
})

it('only administrators manage membership plans and their ticket discount',async()=>{
 await as(owner);await expect(db.query("SELECT save_membership_plan(null,'VIP','',null,5000,'annually','https://example.invalid/v',true,20)")).rejects.toThrow('Administrator')
 await as(admin);const id=await value<string>("SELECT save_membership_plan(null,'VIP','Perks','{Early access}',5000,'annually','https://example.invalid/v',true,20) AS v")
 await expect(db.query("SELECT save_membership_plan($1,'VIP','',null,5000,'annually','http://insecure',true,20)",[id])).rejects.toThrow('https')
 await db.exec('RESET ROLE');expect(await value<number>('SELECT ticket_discount_percent AS v FROM membership_plans WHERE id=$1',[id])).toBe(20)
})

it('public event pages show only administrator-published, non-member events, even to signed-out visitors',async()=>{
 await db.exec('RESET ROLE;SET ROLE anon');expect((await db.query('SELECT * FROM reviewed_public_events()')).rows).toHaveLength(0)
 await as(owner);await expect(db.query("SELECT set_reviewed_public_event($1,'Open day','Come along','Hall',true)",[event])).rejects.toThrow('Administrator')
 await as(admin);await db.query("SELECT set_reviewed_public_event($1,'Open day','Come along','Hall',true)",[event])
 await db.exec('RESET ROLE;SET ROLE anon');const rows=(await db.query<any>('SELECT * FROM reviewed_public_events()')).rows;expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({title:'Open day',venue:'Hall'})
 expect((await db.query('SELECT * FROM reviewed_public_event($1)',[event])).rows).toHaveLength(1)
 await expect(db.query('SELECT * FROM thabaat_public_preview.publications')).rejects.toThrow('permission denied')
 await db.exec('RESET ROLE');await db.query('UPDATE events SET members_only=true WHERE id=$1',[event]);await db.exec('SET ROLE anon')
 expect((await db.query('SELECT * FROM reviewed_public_event($1)',[event])).rows).toHaveLength(0)
})

it('volunteer onboarding opens after approval and shift reminders are queued once',async()=>{
 await as(volunteer);await expect(db.query("SELECT complete_volunteer_onboarding(ARRAY['code_of_conduct','safety','check_in','contact'])")).rejects.toThrow('after your volunteer application')
 await db.exec('RESET ROLE');await db.query("INSERT INTO volunteer_applications(user_id,motivation,status) VALUES($1,'I would like to help welcome guests at community events.','approved')",[volunteer])
 await as(volunteer);await expect(db.query("SELECT complete_volunteer_onboarding(ARRAY['safety'])")).rejects.toThrow('every onboarding step')
 await db.query("SELECT complete_volunteer_onboarding(ARRAY['code_of_conduct','safety','check_in','contact'])")
 expect((await value<any>('SELECT my_volunteer_onboarding() AS v')).completed_at).toBeTruthy()
 await db.exec('RESET ROLE');await db.query("INSERT INTO staff_roles VALUES($1,'volunteer')",[volunteer])
 await db.query("INSERT INTO volunteer_assignments(event_id,user_id,duty,shift_start,shift_end,active,assigned_by) VALUES($1,$2,'Welcome desk',now()+interval '30 hours',now()+interval '33 hours',true,$3)",[event,volunteer,owner])
 await db.exec('SET ROLE service_role');expect(await value<number>('SELECT schedule_volunteer_shift_reminders() AS v')).toBe(1);expect(await value<number>('SELECT schedule_volunteer_shift_reminders() AS v')).toBe(0)
 await db.exec('RESET ROLE');const job=(await db.query<any>("SELECT kind,available_at>now() AS later,payload FROM thabaat_notifications.outbox")).rows[0]
 expect(job).toMatchObject({kind:'volunteer_shift',later:true});expect(job.payload.body).toContain('Welcome desk')
 await as(member);await expect(db.query('SELECT schedule_volunteer_shift_reminders()')).rejects.toThrow('permission denied')
})
