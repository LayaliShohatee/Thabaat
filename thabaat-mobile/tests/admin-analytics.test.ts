/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll, afterAll, it, expect } from 'vitest'
let db:PGlite
const admin='00000000-0000-0000-0000-000000000001',member='00000000-0000-0000-0000-000000000002'
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
type Report={users:{total:number;new:number};memberships:{current_verified:number;complimentary_current:number};verified_payments:{purpose:string;amount_cents:number;count:number}[];daily:{day:string;new_users:number}[]}
const report=()=>db.query<{v:Report}>('SELECT admin_analytics(7) AS v').then(r=>r.rows[0].v)
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20261005003948_staff_volunteer_reporting.sql','migrations/20261005004731_ticket_checkin.sql','migrations/20261005022500_admin_analytics.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'admin@example.invalid','{}'),($2,'member@example.invalid','{}')",[admin,member]);await db.query("INSERT INTO staff_roles VALUES($1,'admin')",[admin])
},30000)
afterAll(async()=>await db?.close())
it('denies member and anonymous aggregate access, validates bounded windows',async()=>{await as(member);await expect(report()).rejects.toThrow('Administrator');await db.exec('RESET ROLE;SET ROLE anon');await expect(report()).rejects.toThrow('permission');await as(admin);await expect(db.query('SELECT admin_analytics(365)')).rejects.toThrow('Choose');await expect(db.query('SELECT admin_analytics(null)')).rejects.toThrow('Choose')})
it('only completed verified payments in window count, complimentary entitlements are separate',async()=>{
 await db.exec('RESET ROLE');await db.query("INSERT INTO membership_plans(name,billing_period) VALUES('Synthetic','monthly')");await db.query("INSERT INTO memberships(user_id,plan_id,status,starts_at,expires_at,source,verified_at) SELECT $1,id,'active',now()-interval '1 day',now()+interval '1 day','complimentary',now()-interval '1 hour' FROM membership_plans",[member])
 for(const [status,paid,verified] of [['completed',-1,-1],['pending',-1,-1],['refunded',-1,-1],['failed',-1,-1],['completed',-10,-1],['completed',1,-1],['completed',-1,1]])await db.query("INSERT INTO payment_records(user_id,provider_payment_id,purpose,description,amount_cents,status,paid_at,verified_at) VALUES($1,gen_random_uuid()::text,'donation','Synthetic test',500,$2,now()+$3*interval '1 day',now()+$4*interval '1 day')",[member,status,paid,verified])
 await as(admin);const r=await report();expect(r.verified_payments).toEqual([{purpose:'donation',currency:'USD',count:1,amount_cents:500}]);expect(r.memberships).toEqual({current_verified:1,complimentary_current:1});expect(JSON.stringify(r)).not.toContain('example.invalid')
})
it('membership expiry is immediate and daily buckets zero-fill without future users',async()=>{
 await db.exec('RESET ROLE');await db.query("UPDATE memberships SET starts_at=now()-interval '2 days',expires_at=now()-interval '1 day'");await db.query("UPDATE profiles SET created_at=now()+interval '1 day' WHERE id=$1",[member]);await as(admin);const r=await report();expect(r.memberships.current_verified).toBe(0);expect(r.users).toEqual({total:2,new:1});expect(r.daily).toHaveLength(8);expect(r.daily.reduce((n,d)=>n+d.new_users,0)).toBe(1)
})
