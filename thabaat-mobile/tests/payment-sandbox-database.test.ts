/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll,beforeAll,beforeEach,expect,it } from 'vitest'
let db:PGlite,event:string,paid:string,plan:string,campaign:string
const admin='00000000-0000-0000-0000-000000000001',owner='00000000-0000-0000-0000-000000000002',member='00000000-0000-0000-0000-000000000004'
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
async function value<T>(sql:string,params:unknown[]=[]){return (await db.query<{v:T}>(sql,params)).rows[0].v}
beforeAll(async()=>{
 db=await PGlite.create();await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20261005003918_registration_lifecycle.sql','migrations/20261005003948_staff_volunteer_reporting.sql','migrations/20261005004731_ticket_checkin.sql','migrations/20261005005702_membership_administration.sql','migrations/20261005012003_campaign_administration.sql','migrations/20261012120200_refunds_discounts.sql','migrations/20261013120000_payment_sandbox.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated;GRANT SELECT ON registrations TO authenticated')
 for(const [id,name] of [[admin,'Admin'],[owner,'Owner'],[member,'Member']])await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,name+'@example.invalid',JSON.stringify({full_name:name})])
},30000)
beforeEach(async()=>{
 await db.exec("RESET ROLE;TRUNCATE refund_requests,promo_codes,payment_records,paid_event_orders,memberships,membership_plans,donation_campaigns,staff_roles,registrations,ticket_types,events CASCADE;UPDATE app_settings SET value='off'")
 await db.query("INSERT INTO staff_roles VALUES($1,'admin'),($2,'organizer')",[admin,owner])
 await as(owner);event=await value<string>("SELECT save_managed_event(null,'Gala','',now()+interval '2 days','Hall',50) AS v")
 await db.exec('RESET ROLE')
 paid=await value<string>("INSERT INTO ticket_types(event_id,name,price,quantity) VALUES($1,'VIP',40,10) RETURNING id AS v",[event])
 plan=await value<string>("INSERT INTO membership_plans(name,amount_cents,billing_period,checkout_url,published,ticket_discount_percent) VALUES('Monthly',1500,'monthly','https://example.invalid/m',true,25) RETURNING id AS v")
 campaign=await value<string>("INSERT INTO donation_campaigns(name,description,checkout_url,goal_cents,published) VALUES('Masjid fund','','https://example.invalid/d',100000,true) RETURNING id AS v")
})
afterAll(async()=>db?.close())

it('everything refuses while payments mode is off, and only admins can switch it',async()=>{
 await as(member);await expect(db.query("SELECT sandbox_purchase_ticket($1,'')",[paid])).rejects.toThrow('turned off')
 await expect(db.query('SELECT sandbox_purchase_membership($1)',[plan])).rejects.toThrow('turned off')
 await expect(db.query('SELECT sandbox_donate($1,500)',[campaign])).rejects.toThrow('turned off')
 await expect(db.query("SELECT set_payments_mode('sandbox')")).rejects.toThrow('Administrator')
 await expect(db.query('SELECT * FROM app_settings')).rejects.toThrow('permission denied')
 await as(admin);await expect(db.query("SELECT set_payments_mode('live')")).rejects.toThrow('off or sandbox')
 await db.query("SELECT set_payments_mode('sandbox')");expect(await value<string>('SELECT payments_mode() AS v')).toBe('sandbox')
})

it('membership purchase activates the member, then member pricing and codes apply to a paid ticket',async()=>{
 await as(admin);await db.query("SELECT set_payments_mode('sandbox')")
 await as(owner);await db.query("SELECT save_promo_code(null,$1,'TEN',null,1000,null,null,true)",[event])
 await as(member);await db.query('SELECT sandbox_purchase_membership($1)',[plan])
 await db.exec('RESET ROLE');expect(await value<boolean>("SELECT (status='active' AND expires_at>now()+interval '27 days' AND provider_subscription_id LIKE 'sandbox\\_%') AS v FROM memberships WHERE user_id=$1",[member])).toBe(true)
 await as(member);const result=await value<any>("SELECT sandbox_purchase_ticket($1,'ten') AS v",[paid])
 expect(result.charged_cents).toBe(2000) // $40 − 25% member ($10) − $10 code
 await expect(db.query("SELECT sandbox_purchase_ticket($1,'')",[paid])).rejects.toThrow('already registered')
 await db.exec('RESET ROLE')
 expect(await value<string>('SELECT status AS v FROM registrations WHERE id=$1',[result.registration_id])).toBe('confirmed')
 expect((await db.query<{purpose:string;amount_cents:number}>("SELECT purpose,amount_cents FROM payment_records WHERE user_id=$1 ORDER BY purpose",[member])).rows).toEqual([{purpose:'event',amount_cents:2000},{purpose:'membership',amount_cents:1500}])
})

it('donations update campaign totals, and approved refunds mark the sandbox payment refunded',async()=>{
 await as(admin);await db.query("SELECT set_payments_mode('sandbox')")
 await as(member);await expect(db.query('SELECT sandbox_donate($1,50)',[campaign])).rejects.toThrow('between $1')
 await db.query('SELECT sandbox_donate($1,2500)',[campaign])
 const listing=await value<any[]>('SELECT campaign_listing() AS v');expect(listing[0].raised_cents).toBe(2500)
 const reg=(await value<any>("SELECT sandbox_purchase_ticket($1,'') AS v",[paid])).registration_id
 const request=await value<string>("SELECT request_refund($1,'Cannot attend') AS v",[reg])
 await as(owner);await db.query("SELECT review_refund_request($1,true,'ok')",[request])
 await db.exec('RESET ROLE')
 expect(await value<string>("SELECT status AS v FROM payment_records WHERE user_id=$1 AND purpose='event'",[member])).toBe('refunded')
 expect(await value<string>('SELECT status AS v FROM registrations WHERE id=$1',[reg])).toBe('cancelled')
})
