/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest'
let db:PGlite
const member='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',organizer='00000000-0000-0000-0000-000000000003'
const free='10000000-0000-0000-0000-000000000001',paid='10000000-0000-0000-0000-000000000002',draft='10000000-0000-0000-0000-000000000003'
async function as(id=member){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage TO authenticated; GRANT SELECT ON storage.objects TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20261005004630_media_library.sql','migrations/20261005004630_media_library.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'one@example.invalid','{}'),($2,'two@example.invalid','{}'),($3,'three@example.invalid','{}')",[member,other,organizer])
 await db.query("INSERT INTO staff_roles VALUES($1,'organizer')",[organizer])
 await db.query("INSERT INTO media_items(id,title,category,object_path,members_only,published,created_by) VALUES($1,'Open talk','Talks','free.mp4',false,true,$4),($2,'Member talk','Talks','paid.mp4',true,true,$4),($3,'Draft talk','Talks','draft.mp4',false,false,$4)",[free,paid,draft,organizer])
 await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('thabaat-media','free.mp4'),('thabaat-media','paid.mp4'),('thabaat-media','draft.mp4'),('thabaat-media','orphan.mp4'); INSERT INTO membership_plans(id,name,billing_period) VALUES('20000000-0000-0000-0000-000000000001','Test plan','monthly')")
},30000)
beforeEach(async()=>{await db.exec('RESET ROLE; DELETE FROM memberships; DELETE FROM media_progress');await as()})
afterAll(async()=>await db?.close())
async function activate(status='active',expires="now()+interval '1 day'",verified='now()'){await db.exec('RESET ROLE');await db.query(`INSERT INTO memberships(user_id,plan_id,status,starts_at,expires_at,source,verified_at) VALUES($1,'20000000-0000-0000-0000-000000000001',$2,now()-interval '3 days',${expires},'complimentary',${verified})`,[member,status]);await as()}
it('free user discovers published metadata but cannot read member/draft/orphan objects',async()=>{
 expect((await db.query('SELECT id FROM media_items')).rows).toHaveLength(2)
 expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([])
})
it('active verified member accesses gated object; expiry immediately removes new object access',async()=>{
 await activate();expect((await db.query('SELECT get_media_playback_path($1) AS path',[paid])).rows).toEqual([{path:'paid.mp4'}]);expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([])
 await db.exec("RESET ROLE; UPDATE memberships SET expires_at=now()-interval '1 day'");await as()
 await expect(db.query('SELECT get_media_playback_path($1)',[paid])).rejects.toThrow('Media access denied')
})
it.each(['past_due','cancelled','expired'])('%s membership cannot access member media',async status=>{await activate(status);await expect(db.query('SELECT get_media_playback_path($1)',[paid])).rejects.toThrow('Media access denied')})
it('future verification cannot manufacture access',async()=>{await activate('active',"now()+interval '1 day'","now()+interval '1 hour'");await expect(db.query('SELECT get_media_playback_path($1)',[paid])).rejects.toThrow('Media access denied')})
it('progress stays private and cannot be forged for unavailable media or another account',async()=>{
 await db.query('INSERT INTO media_progress(media_id,seconds) VALUES($1,12)',[free]);await as(other)
 expect((await db.query('SELECT * FROM media_progress')).rows).toEqual([])
 await expect(db.query('INSERT INTO media_progress(user_id,media_id,seconds) VALUES($1,$2,3)',[member,free])).rejects.toThrow('row-level security')
 await expect(db.query('INSERT INTO media_progress(media_id,seconds) VALUES($1,3)',[paid])).rejects.toThrow('row-level security')
})
it('organizer sees own drafts; ordinary account cannot publish, alter or delete catalog',async()=>{
 await as(organizer);expect((await db.query('SELECT id FROM media_items')).rows).toHaveLength(3)
 expect((await db.query('SELECT get_media_playback_path($1) AS path',[draft])).rows).toEqual([{path:'draft.mp4'}])
 await as();await expect(db.query("INSERT INTO media_items(title,category,object_path) VALUES('Forged','Talks','forged.mp4')")).rejects.toThrow('row-level security')
 expect((await db.query('UPDATE media_items SET published=false RETURNING id')).rows).toEqual([])
 expect((await db.query('DELETE FROM media_items RETURNING id')).rows).toEqual([])
})
it('signed-out client cannot query catalog or manufacture progress',async()=>{await db.exec('RESET ROLE; SET ROLE anon');await expect(db.query('SELECT * FROM media_items')).rejects.toThrow('permission denied');await expect(db.query('SELECT private.media_access($1)',[free])).rejects.toThrow('permission denied')})

it('unpublishing removes media object access for members',async()=>{await activate();await db.exec('RESET ROLE');await db.query('UPDATE media_items SET published=false WHERE id=$1',[paid]);await as();await expect(db.query('SELECT get_media_playback_path($1)',[paid])).rejects.toThrow('Media access denied');await db.exec('RESET ROLE');await db.query('UPDATE media_items SET published=true WHERE id=$1',[paid])})

it('RPC denies expired/free caller on member item while permitting public item; no client token minting',async()=>{expect((await db.query('SELECT get_media_playback_path($1) AS path',[free])).rows).toEqual([{path:'free.mp4'}]);await expect(db.query('SELECT get_media_playback_path($1)',[paid])).rejects.toThrow('Media access denied');await activate('expired');await expect(db.query('SELECT get_media_playback_path($1)',[paid])).rejects.toThrow('Media access denied')})
it('organizer can create, edit and delete own catalog entry while saved progress cascades',async()=>{
 await as(organizer)
 const created=(await db.query<{id:string}>("INSERT INTO media_items(title,category,object_path) VALUES('Own recording','Talks','own-recording.mp4') RETURNING id")).rows[0].id
 expect((await db.query("UPDATE media_items SET title='Own edited recording' WHERE id=$1 RETURNING title",[created])).rows).toEqual([{title:'Own edited recording'}])
 await db.query('INSERT INTO media_progress(media_id,seconds) VALUES($1,12)',[created])
 expect((await db.query('DELETE FROM media_items WHERE id=$1 RETURNING id',[created])).rows).toHaveLength(1)
 expect((await db.query('SELECT * FROM media_progress WHERE media_id=$1',[created])).rows).toEqual([])
})
