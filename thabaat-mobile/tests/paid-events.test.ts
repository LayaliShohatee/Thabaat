/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
const u1='00000000-0000-0000-0000-000000000001',u2='00000000-0000-0000-0000-000000000002'
const event='71000000-0000-4000-8000-000000000001',ticket='72000000-0000-4000-8000-000000000001'
const form='5451350b-cef4-4e59-8240-aa457d4f7c7e'
let db:PGlite
async function asUser(id=u1) { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('SET ROLE authenticated') }
async function asOperator() { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub','',false)") }
async function begin() { return (await db.query<{id:string}>("SELECT id FROM begin_paid_event_checkout($1)",[ticket])).rows[0].id }
async function confirm(order:string,payment='fixture-payment-1',amount=100,currency='USD',formId=form) {
 return db.query('SELECT confirm_paid_event_manually($1,$2,$3,$4,$5,$6) AS id',[order,payment,amount,currency,formId,'Local fixture only: verified completed provider record for exact app order.'])
}
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260928_paid_event_test.sql','paid_event_test_seed.sql','paid_event_test_seed.sql']) await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 for (let i=0;i<2;i++) await db.exec(await readFile(new URL('../database/migrations/20260929_charitystack_transport.sql',import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'one@example.invalid','{}'),($2,'two@example.invalid','{}')",[u1,u2])
 await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON registrations TO authenticated; GRANT SELECT ON events,ticket_types TO authenticated')
},30000)
beforeEach(async()=>{await asOperator();await db.exec("TRUNCATE charitystack_checkout_links,charitystack_webhook_inbox,registrations,paid_event_orders,payment_records,checkout_attempts; UPDATE events SET capacity=1,event_date=now()+interval '1 day'; UPDATE ticket_types SET price=1,quantity=1; UPDATE paid_event_checkout_configs SET enabled=true;");await asUser()})
afterAll(async()=>{await db?.close()})
it('creates a paid-only event with no free ticket',async()=>expect((await db.query('SELECT price FROM ticket_types WHERE event_id=$1',[event])).rows).toEqual([{price:'1.00'}]))
it('keeps private content locked before payment',async()=>expect((await db.query('SELECT * FROM event_access_details')).rows).toHaveLength(0))
it('keeps provider transport and donor payloads inaccessible to app accounts', async()=>{
 for (const table of ['charitystack_checkout_links','charitystack_webhook_inbox']) await expect(db.query('SELECT * FROM '+table)).rejects.toThrow(/permission denied/)
})
it('reuses a pending checkout without registering the user',async()=>{const id=await begin();expect(await begin()).toBe(id);expect((await db.query('SELECT * FROM registrations')).rows).toHaveLength(0)})
it('blocks fake paid registration',async()=>{await begin();await expect(db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[u1,event,ticket])).rejects.toThrow('requires verified payment')})
it('prevents a client approving or modifying payment',async()=>{const id=await begin();await expect(confirm(id)).rejects.toThrow(/permission denied/);await expect(db.query("UPDATE paid_event_orders SET status='completed',provider_payment_id='fake',verified_at=now() WHERE id=$1",[id])).rejects.toThrow(/permission denied/)})
it('rejects anonymous checkout creation',async()=>{await asOperator();await db.exec('SET ROLE anon');await expect(begin()).rejects.toThrow(/permission denied/)})
it('prevents another account reading the checkout or taking its held seat',async()=>{await begin();await asUser(u2);expect((await db.query('SELECT * FROM paid_event_orders')).rows).toHaveLength(0);await expect(begin()).rejects.toThrow('No test seats available')})
it.each([[99,'USD',form],[100,'EUR',form],[100,'USD','different-form']])('rejects mismatched payment %s/%s/%s',async(amount,currency,formId)=>{const id=await begin();await asOperator();await expect(confirm(id,'fixture-payment',Number(amount),String(currency),String(formId))).rejects.toThrow('does not match');expect((await db.query('SELECT * FROM registrations')).rows).toHaveLength(0)})
it('unlocks only the paid account and adds exactly one registration/history record',async()=>{const id=await begin();await asOperator();await confirm(id);await confirm(id);expect((await db.query('SELECT * FROM registrations')).rows).toHaveLength(1);expect((await db.query('SELECT * FROM payment_records')).rows).toHaveLength(1);await asUser();expect((await db.query('SELECT * FROM event_access_details')).rows).toHaveLength(1);await asUser(u2);expect((await db.query('SELECT * FROM event_access_details')).rows).toHaveLength(0)})
it('cannot reuse a payment ID for a second account',async()=>{const first=await begin();await asOperator();await confirm(first);await db.exec('UPDATE events SET capacity=2; UPDATE ticket_types SET quantity=2');await asUser(u2);const second=await begin();await asOperator();await expect(confirm(second)).rejects.toThrow(/unique/);expect((await db.query("SELECT status FROM paid_event_orders WHERE id=$1",[second])).rows).toEqual([{status:'pending'}])})
it('refund status removes access even when an old registration remains',async()=>{const id=await begin();await asOperator();await confirm(id);await db.query("UPDATE paid_event_orders SET status='refunded' WHERE id=$1",[id]);await asUser();expect((await db.query('SELECT * FROM event_access_details')).rows).toHaveLength(0)})
it('rolls back payment approval if the event can no longer be fulfilled',async()=>{const id=await begin();await asOperator();await db.exec("UPDATE events SET event_date=now()-interval '1 day'");await expect(confirm(id)).rejects.toThrow('Registration is closed');expect((await db.query('SELECT * FROM payment_records')).rows).toHaveLength(0);expect((await db.query('SELECT status FROM paid_event_orders')).rows).toEqual([{status:'pending'}])})
it('leaves normal free registration behavior available',async()=>{await asOperator();await db.exec('UPDATE ticket_types SET price=0');await asUser();await db.query('INSERT INTO registrations(user_id,event_id,ticket_type_id) VALUES($1,$2,$3)',[u1,event,ticket]);expect((await db.query('SELECT status FROM registrations')).rows).toEqual([{status:'confirmed'}]);expect((await db.query('SELECT * FROM event_access_details')).rows).toHaveLength(0)})
