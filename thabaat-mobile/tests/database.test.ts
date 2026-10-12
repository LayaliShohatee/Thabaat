/// <reference types="node" />
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// An isolated PostgreSQL engine; no tests connect to the team's hosted database.
const u1 = '00000000-0000-0000-0000-000000000001'
const u2 = '00000000-0000-0000-0000-000000000002'
const e1 = '10000000-0000-0000-0000-000000000001'
const e2 = '10000000-0000-0000-0000-000000000002'
const t1 = '20000000-0000-0000-0000-000000000001'
let db: PGlite
let migration: string
async function asUser(user = u1) {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user])
  await db.exec('SET ROLE authenticated')
}
const reserve = (user = u1, event = e1, ticket = t1) => db.query('INSERT INTO public.registrations(user_id,event_id,ticket_type_id) VALUES ($1,$2,$3) RETURNING status', [user, event, ticket])

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
  await db.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  // Reproduce the missing columns observed with read-only live schema probes.
  await db.exec('ALTER TABLE profiles DROP COLUMN expo_push_token; ALTER TABLE registrations DROP COLUMN status; ALTER TABLE events DROP COLUMN capacity; ALTER TABLE ticket_types DROP COLUMN quantity;')
  migration = await readFile(new URL('../database/migrations/20260921_prototype_integrity.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  await db.query("INSERT INTO auth.users VALUES ($1,'one@example.invalid','{\"full_name\":\"One\"}'),($2,'two@example.invalid','{\"full_name\":\"Two\"}')", [u1,u2])
  await db.query("INSERT INTO events(id,title,event_date,location) VALUES ($1,'Event One',now()+interval '1 day','Test'),($2,'Event Two',now()+interval '1 day','Test')", [e1,e2])
  await db.query("INSERT INTO ticket_types(id,event_id,name,price) VALUES ($1,$2,'Free',0)", [t1,e1])
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated')
}, 30_000)
beforeEach(async () => {
  await db.exec("RESET ROLE; TRUNCATE registrations; UPDATE events SET capacity=100,event_date=now()+interval '1 day'; UPDATE ticket_types SET quantity=50,price=0;")
  await asUser()
})
afterAll(async () => { await db?.close() })

describe('prototype migration and row ownership', () => {
  it('creates a profile from the auth user, visible only to that user', async () => {
    const { rows } = await db.query<{ id: string; full_name: string }>('SELECT id,full_name FROM profiles')
    expect(rows).toEqual([{ id: u1, full_name: 'One' }])
  })
  it('prevents updating another profile', async () => {
    const result = await db.query("UPDATE profiles SET full_name='changed' WHERE id=$1", [u2])
    expect(result.affectedRows).toBe(0)
  })
  it('creates a confirmed free registration', async () => expect((await reserve()).rows).toEqual([{ status: 'confirmed' }]))
  it('rejects duplicate registrations', async () => { await reserve(); await expect(reserve()).rejects.toThrow(/unique/i) })
  it('rejects a ticket from a different event', async () => await expect(reserve(u1,e2)).rejects.toThrow('Ticket does not belong'))
  it('rejects registering someone else', async () => await expect(reserve(u2)).rejects.toThrow('only register yourself'))
  it('hides another user registration', async () => { await reserve(); await asUser(u2); expect((await db.query('SELECT * FROM registrations')).rows).toEqual([]) })
  it('does not accept paid tickets without payment verification', async () => {
    await db.exec('RESET ROLE; UPDATE ticket_types SET price=10;'); await asUser()
    await expect(reserve()).rejects.toThrow('Paid checkout')
  })
  it('rejects a sold-out event', async () => {
    await db.exec('RESET ROLE; UPDATE events SET capacity=1;'); await asUser(); await reserve(); await asUser(u2)
    await expect(reserve(u2)).rejects.toThrow('Event is sold out')
  })
  it('rejects sold-out ticket inventory', async () => {
    await db.exec('RESET ROLE; UPDATE ticket_types SET quantity=0;'); await asUser()
    await expect(reserve()).rejects.toThrow('Ticket type is sold out')
  })
  it('rejects past events', async () => {
    await db.exec("RESET ROLE; UPDATE events SET event_date=now()-interval '1 day';"); await asUser()
    await expect(reserve()).rejects.toThrow('Registration is closed')
  })
})
