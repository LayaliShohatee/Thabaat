/// <reference types="node" />
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
let db: PGlite
const u1 = '00000000-0000-0000-0000-000000000001'
const u2 = '00000000-0000-0000-0000-000000000002'
async function asUser(user = u1) {
 await db.exec('RESET ROLE')
 await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user])
 await db.exec('SET ROLE authenticated')
}
beforeAll(async () => {
 db = await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 const sql = await readFile(new URL('../database/migrations/20260928_membership_billing.sql', import.meta.url), 'utf8')
 await db.exec(sql); await db.exec(sql)
 await db.query('INSERT INTO profiles VALUES ($1),($2)', [u1,u2])
 await db.exec(`INSERT INTO membership_plans(id,name,billing_period,amount_cents,checkout_url,published) VALUES ('10000000-0000-0000-0000-000000000001','Local fixture plan','monthly',100,'https://charitystack.com/donate/local-fixture',true);
 INSERT INTO membership_plans(name,billing_period) VALUES ('Unpublished fixture','one_time');`)
}, 30000)
beforeEach(async () => { await db.exec('RESET ROLE; TRUNCATE checkout_attempts, memberships, payment_records;'); await asUser() })
afterAll(async () => { await db?.close() })
it('hides unpublished offers', async () => expect((await db.query('SELECT name FROM membership_plans')).rows).toEqual([{ name: 'Local fixture plan' }]))
it('creates only a pending checkout with a server-set price and reuses it', async () => {
 const a = (await db.query('SELECT id,status,expected_amount_cents FROM begin_internal_payment_check()')).rows
 const b = (await db.query('SELECT id,status,expected_amount_cents FROM begin_internal_payment_check()')).rows
 expect(a).toEqual(b); expect(a[0]).toMatchObject({ status:'pending', expected_amount_cents:100 })
})
it('keeps checkout records private', async () => { await db.query('SELECT begin_internal_payment_check()'); await asUser(u2); expect((await db.query('SELECT * FROM checkout_attempts')).rows).toEqual([]) })
it('cannot self-confirm checkout', async () => {
 await db.query('SELECT begin_internal_payment_check()')
 await expect(db.query("UPDATE checkout_attempts SET status='completed',provider_payment_id='fake',verified_at=now()" )).rejects.toThrow(/permission denied/)
})
it('cannot grant yourself a membership or fake payment', async () => {
 await expect(db.query('INSERT INTO memberships DEFAULT VALUES')).rejects.toThrow(/permission denied/)
 await expect(db.query('INSERT INTO payment_records DEFAULT VALUES')).rejects.toThrow(/permission denied/)
})
it('isolates history and membership status between accounts', async () => {
 await db.exec('RESET ROLE')
 await db.query("INSERT INTO payment_records(user_id,provider_payment_id,purpose,description,amount_cents,status,paid_at,verified_at) VALUES($1,'fixture-1','donation','Local fixture',100,'completed',now(),now())", [u1])
 await db.query("INSERT INTO memberships(user_id,plan_id,status,starts_at,expires_at,source,verified_at) VALUES($1,'10000000-0000-0000-0000-000000000001','active',now(),now()+interval '1 month','complimentary',now())", [u1])
 await asUser(u1); expect((await db.query('SELECT * FROM payment_records')).rows).toHaveLength(1)
 await asUser(u2); expect((await db.query('SELECT * FROM payment_records')).rows).toHaveLength(0); expect((await db.query('SELECT * FROM memberships')).rows).toHaveLength(0)
})
it('does not allow anonymous checkout creation', async () => { await db.exec('RESET ROLE; SET ROLE anon'); await expect(db.query('SELECT begin_internal_payment_check()')).rejects.toThrow(/permission denied/) })
it('requires a verified provider record for final payment states', async () => {
 await db.query('SELECT begin_internal_payment_check()'); await db.exec('RESET ROLE')
 await expect(db.query("UPDATE checkout_attempts SET status='completed'")).rejects.toThrow(/check constraint/)
})
