import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {beforeAll,afterAll,expect,it} from 'vitest'
import {validateMediaUpload,validateMediaHeader,mediaUploadPath,MAX_MEDIA_BYTES} from '../lib/media-upload'
let db:PGlite
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',staff='00000000-0000-0000-0000-000000000003',media='10000000-0000-0000-0000-000000000001',second='10000000-0000-0000-0000-000000000002',playlist='20000000-0000-0000-0000-000000000001'
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE profiles(id uuid PRIMARY KEY);CREATE TABLE staff_roles(user_id uuid PRIMARY KEY,role text);CREATE FUNCTION public.current_staff_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM public.staff_roles WHERE user_id=auth.uid() $$;CREATE TABLE memberships(user_id uuid,status text,starts_at timestamptz,expires_at timestamptz,verified_at timestamptz);
 CREATE FUNCTION public.account_is_active(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT NOT coalesce(current_setting('test.suspended',true),'false')::boolean $$;CREATE FUNCTION public.assert_active_account() RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT public.account_is_active(auth.uid()) THEN RAISE EXCEPTION 'Account suspended'; END IF; END $$;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
 CREATE POLICY unrelated_broad_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(true);`)
 for(const migration of ['20261005004630_media_library.sql','20261005020944_media_playlists_uploads.sql'])await db.exec(await readFile(new URL('../database/migrations/'+migration,import.meta.url),'utf8'))
 // Isolated fixture mirrors the final account guard sweep without the unrelated event/account tables.
 await db.exec('CREATE POLICY account_active_guard ON public.media_playlists AS RESTRICTIVE TO authenticated USING(public.account_is_active(auth.uid())) WITH CHECK(public.account_is_active(auth.uid()));CREATE POLICY account_active_guard ON public.media_playlist_items AS RESTRICTIVE TO authenticated USING(public.account_is_active(auth.uid())) WITH CHECK(public.account_is_active(auth.uid()));')
 await db.query('INSERT INTO profiles VALUES($1),($2),($3)',[owner,other,staff]);await db.query("INSERT INTO staff_roles VALUES($1,'organizer')",[staff])
 await db.query("INSERT INTO media_items(id,title,category,object_path,members_only,published,created_by) VALUES($1,'Protected recording','Talks','protected.mp4',true,true,$3),($2,'Open recording','Talks','open.mp4',false,true,$3)",[media,second,staff]);await as(owner)
},30000)
afterAll(async()=>await db?.close())
it('validates extension, MIME, size, binary header and namespace before upload',()=>{
 const asset={name:'approved.mp4',size:20,mimeType:'video/mp4',uri:'file://synthetic'}
 expect(validateMediaUpload(asset).mime).toBe('video/mp4');expect(()=>validateMediaUpload({...asset,name:'a.exe'})).toThrow();expect(()=>validateMediaUpload({...asset,mimeType:'text/html'})).toThrow();expect(()=>validateMediaUpload({...asset,size:MAX_MEDIA_BYTES+1})).toThrow();expect(()=>validateMediaUpload({...asset,size:undefined})).toThrow()
 expect(()=>validateMediaHeader(new Uint8Array([0,0,0,0,102,116,121,112,0,0,0,0]))).not.toThrow();expect(()=>validateMediaHeader(new Uint8Array(12))).toThrow()
 expect(mediaUploadPath(staff,'mp4','a'.repeat(32))).toBe(`${staff}/${'a'.repeat(32)}.mp4`);expect(()=>mediaUploadPath(staff,'mp4','../other')).toThrow()
})
it('private playlist CRUD and item ordering reject another account, including direct RPC',async()=>{
 await as(owner);await db.query("INSERT INTO media_playlists(id,name) VALUES($1,'My talks')",[playlist]);await db.query('INSERT INTO media_playlist_items VALUES($1,$2,0),($1,$3,1)',[playlist,media,second]);await db.query('SELECT move_media_playlist_item($1,$2,-1)',[playlist,second]);expect((await db.query('SELECT media_id FROM media_playlist_items ORDER BY position')).rows).toEqual([{media_id:second},{media_id:media}])
 await as(other);expect((await db.query('SELECT * FROM media_playlists')).rows).toEqual([]);expect((await db.query('SELECT * FROM media_playlist_items')).rows).toEqual([]);await expect(db.query('INSERT INTO media_playlist_items VALUES($1,$2,2)',[playlist,second])).rejects.toThrow('row-level security');await expect(db.query('SELECT move_media_playlist_item($1,$2,1)',[playlist,second])).rejects.toThrow('Playlist access denied');expect((await db.query("UPDATE media_playlists SET name='Stolen' RETURNING id")).rows).toEqual([])
})
it('saving protected metadata to a playlist never grants playback, including expired membership',async()=>{
 await as(owner);await expect(db.query('SELECT get_media_playback_path($1)',[media])).rejects.toThrow('Media access denied');await db.exec('RESET ROLE');await db.query("INSERT INTO memberships VALUES($1,'active',now()-interval '1 day',now()+interval '1 day',now())",[owner]);await as(owner);expect((await db.query('SELECT get_media_playback_path($1) AS path',[media])).rows).toEqual([{path:'protected.mp4'}]);await db.exec("RESET ROLE;UPDATE memberships SET expires_at=now()-interval '1 second'");await as(owner);await expect(db.query('SELECT get_media_playback_path($1)',[media])).rejects.toThrow('Media access denied')
})
it('staff uploads only own namespaced allowed size/type; broad sibling policy cannot bypass it',async()=>{
 const insert=(id:string,size=12,mime='video/mp4')=>db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3)',['thabaat-media',`${id}/${'a'.repeat(32)}.mp4`,JSON.stringify({size,mimetype:mime})])
 await as(owner);await expect(insert(owner)).rejects.toThrow('row-level security');await as(staff);await insert(staff);await expect(insert(owner)).rejects.toThrow('row-level security');await expect(insert(staff,MAX_MEDIA_BYTES+1)).rejects.toThrow('row-level security');await expect(insert(staff,12,'text/html')).rejects.toThrow('row-level security');expect((await db.query('SELECT * FROM storage.objects')).rows).toEqual([])
 await expect(db.query("INSERT INTO media_items(title,category,object_path) VALUES('Foreign recording','Talks','foreign.mp4')")).rejects.toThrow('own media namespace')
})
it('suspended playlist owners cannot read/edit or reorder their saved lists',async()=>{
 await as(owner);await db.exec("SELECT set_config('test.suspended','true',false)")
 try{expect((await db.query('SELECT * FROM media_playlists')).rows).toEqual([]);expect((await db.query('SELECT * FROM media_playlist_items')).rows).toEqual([]);await expect(db.query('SELECT move_media_playlist_item($1,$2,1)',[playlist,media])).rejects.toThrow('Account suspended');await expect(db.query("INSERT INTO media_playlists(name) VALUES('Suspended list')")).rejects.toThrow('row-level security')}finally{await db.exec("SELECT set_config('test.suspended','false',false)")}
})
