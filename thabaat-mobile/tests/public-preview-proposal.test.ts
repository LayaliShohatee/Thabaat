/// <reference types="node" />
import {beforeAll,afterAll,expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
let db:PGlite
const user='00000000-0000-0000-0000-000000000001',event='10000000-0000-0000-0000-000000000001'
beforeAll(async()=>{
 db=await PGlite.create();await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION public.current_staff_role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.staff_role',true)$$;
 CREATE TABLE profiles(id uuid PRIMARY KEY);CREATE TABLE events(id uuid PRIMARY KEY,event_date timestamptz,archived boolean DEFAULT false,members_only boolean DEFAULT false,description text,address text);
 INSERT INTO profiles VALUES('${user}');INSERT INTO events(id,event_date,description,address) VALUES('${event}',now()+interval '1 day','PRIVATE logistics','PRIVATE exact address');
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 // Test proposal only in isolated PostgreSQL; never applied to local rollout or hosted DB.
 await db.exec(await readFile(new URL('../database/proposals/public_event_preview.sql',import.meta.url),'utf8'))
},30000)
afterAll(async()=>{await db?.close()})
it('anonymous sees no real event without separate explicit publication and cannot inspect private records',async()=>{
 await db.exec('SET ROLE anon;')
 expect((await db.query('SELECT * FROM reviewed_public_event($1)',[event])).rows).toEqual([])
 await expect(db.exec('SELECT * FROM events')).rejects.toThrow()
 await expect(db.exec('SELECT * FROM thabaat_public_preview.publications')).rejects.toThrow()
})
it('public projection uses only manually reviewed fields and is revoked automatically by member/archive state',async()=>{
 await db.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','${user}',false);SELECT set_config('test.staff_role','admin',false);SET ROLE authenticated;`)
 await db.query('SELECT set_reviewed_public_event($1,$2,$3,$4,true)',[event,'Reviewed title','Reviewed public summary','Community center'])
 await db.exec('RESET ROLE;SET ROLE anon;')
 const row=(await db.query<Record<string,unknown>>('SELECT * FROM reviewed_public_event($1)',[event])).rows[0]
 expect(Object.keys(row)).toEqual(['event_id','title','summary','event_date','venue'])
 expect(JSON.stringify(row)).not.toContain('PRIVATE')
 await db.exec(`RESET ROLE;UPDATE events SET members_only=true;SET ROLE anon;`)
 expect((await db.query('SELECT * FROM reviewed_public_event($1)',[event])).rows).toEqual([])
 await db.exec('RESET ROLE;UPDATE events SET members_only=false,archived=true;SET ROLE anon;')
 expect((await db.query('SELECT * FROM reviewed_public_event($1)',[event])).rows).toEqual([])
})
it('ordinary authenticated clients cannot opt real events into public exposure',async()=>{
 await db.exec(`RESET ROLE;SELECT set_config('test.staff_role','',false);SET ROLE authenticated;`)
 await expect(db.query('SELECT set_reviewed_public_event($1,$2,$3,$4,true)',[event,'Malicious title','Injected','Somewhere'])).rejects.toThrow('Administrator')
})
