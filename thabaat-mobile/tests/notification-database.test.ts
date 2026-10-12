/// <reference types="node" />
import {beforeAll,afterAll,expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
const u1='00000000-0000-0000-0000-000000000001',u2='00000000-0000-0000-0000-000000000002'
let db:PGlite
async function asUser(id=u1){await db.exec('RESET ROLE');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE profiles(id uuid PRIMARY KEY,expo_push_token text); CREATE TABLE registrations(id uuid PRIMARY KEY,user_id uuid,event_id uuid,status text);
 CREATE TABLE events(id uuid PRIMARY KEY,event_date timestamptz,title text,archived boolean DEFAULT false); CREATE TABLE memberships(id uuid PRIMARY KEY,user_id uuid,status text,starts_at timestamptz,verified_at timestamptz,expires_at timestamptz); CREATE TABLE registration_history(id uuid PRIMARY KEY,registration_id uuid,user_id uuid,event_id uuid,action text,created_at timestamptz DEFAULT now()); CREATE TABLE staff_roles(user_id uuid,role text); CREATE TABLE volunteer_assignments(user_id uuid,event_id uuid,active boolean); CREATE FUNCTION public.current_staff_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT role FROM public.staff_roles WHERE user_id=auth.uid()$$;
 GRANT USAGE ON SCHEMA auth,public TO authenticated,service_role; GRANT SELECT ON profiles,registrations,events,memberships,registration_history TO service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 const sql=await readFile(new URL('../database/migrations/20261005004111_notification_preferences_outbox.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 await db.query('INSERT INTO profiles(id) VALUES($1),($2)',[u1,u2])
},30000)
afterAll(async()=>{await db?.close()})
it('preferences are private, explicit opt-in and cannot be assigned to another user',async()=>{
 await asUser();await db.query('INSERT INTO notification_preferences(user_id) VALUES($1)',[u1])
 expect((await db.query('SELECT push_enabled,reminders FROM notification_preferences')).rows).toEqual([{push_enabled:false,reminders:[]}])
 await expect(db.query('INSERT INTO notification_preferences(user_id) VALUES($1)',[u2])).rejects.toThrow()
 await asUser(u2);expect((await db.query('SELECT * FROM notification_preferences')).rows).toEqual([])
 await expect(db.exec('SELECT * FROM thabaat_notifications.outbox')).rejects.toThrow()
})
it('scheduler is service-only, persists selected reminders once, and excludes cancelled users',async()=>{
 await db.exec(`RESET ROLE;
 INSERT INTO events(id,event_date,title) VALUES('10000000-0000-0000-0000-000000000001',now()+interval '10 days','Synthetic event');
 INSERT INTO registrations VALUES('20000000-0000-0000-0000-000000000001','${u1}','10000000-0000-0000-0000-000000000001','confirmed');
 INSERT INTO registrations VALUES('20000000-0000-0000-0000-000000000002','${u2}','10000000-0000-0000-0000-000000000001','cancelled');
 UPDATE notification_preferences SET push_enabled=true,reminders=ARRAY['day','starting'] WHERE user_id='${u1}';
 INSERT INTO notification_preferences(user_id,push_enabled,reminders) VALUES('${u2}',true,ARRAY['day']);`)
 await asUser();await expect(db.exec('SELECT thabaat_notifications.schedule_due_notifications()')).rejects.toThrow()
 await db.exec('RESET ROLE; SET ROLE service_role;')
 expect((await db.query('SELECT thabaat_notifications.schedule_due_notifications() AS added')).rows).toEqual([{added:2}])
 expect((await db.query('SELECT thabaat_notifications.schedule_due_notifications() AS added')).rows).toEqual([{added:0}])
 expect((await db.query('SELECT kind,user_id FROM thabaat_notifications.outbox ORDER BY kind')).rows).toEqual([{kind:'day',user_id:u1},{kind:'starting',user_id:u1}])
})
it('registration history creates one confirmation per lifecycle transition and repeated claims do not resend',async()=>{
 await db.exec(`RESET ROLE;UPDATE notification_preferences SET confirmations=true WHERE user_id='${u1}';
 INSERT INTO registration_history(id,registration_id,user_id,event_id,action) VALUES('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','${u1}','10000000-0000-0000-0000-000000000001','registered'); SET ROLE service_role;`)
 const result=await db.query<{claim:{id:string,status:string}}>('SELECT claim_registration_confirmation($1,$2) AS claim',[u1,'10000000-0000-0000-0000-000000000001'])
 expect(result.rows[0].claim.status).toBe('claimed')
 const id=result.rows[0].claim.id
 expect((await db.query<{claim:{status:string}}>('SELECT claim_registration_confirmation($1,$2) AS claim',[u1,'10000000-0000-0000-0000-000000000001'])).rows[0].claim.status).toBe('dispatching')
 await db.query("SELECT complete_notification_job($1,'accepted')",[id])
 expect((await db.query<{claim:{status:string}}>('SELECT claim_registration_confirmation($1,$2) AS claim',[u1,'10000000-0000-0000-0000-000000000001'])).rows[0].claim.status).toBe('accepted')
 await asUser();await expect(db.query('SELECT claim_registration_confirmation($1,$2)',[u1,'10000000-0000-0000-0000-000000000001'])).rejects.toThrow()
})
it('administrator review and queue respect consent, segment, immutable request and dedupe',async()=>{
 await db.exec(`RESET ROLE;UPDATE notification_preferences SET categories=ARRAY['conferences'] WHERE user_id='${u1}'; INSERT INTO staff_roles VALUES('${u1}','admin');`)
 await asUser(u2);await expect(db.query("SELECT review_notification_broadcast('conferences',NULL,false)")).rejects.toThrow('Administrator')
 await asUser();expect((await db.query("SELECT review_notification_broadcast('conferences',NULL,false) AS count")).rows).toEqual([{count:1}])
 const args=['40000000-0000-0000-0000-000000000001','conferences',null,false,'Fixture broadcast','Synthetic review-only message']
 expect((await db.query('SELECT queue_notification_broadcast($1,$2,$3,$4,$5,$6) AS queued',args)).rows).toEqual([{queued:1}])
 expect((await db.query('SELECT queue_notification_broadcast($1,$2,$3,$4,$5,$6) AS queued',args)).rows).toEqual([{queued:1}])
 await expect(db.query('SELECT queue_notification_broadcast($1,$2,$3,$4,$5,$6)',[...args.slice(0,5),'Changed content'])).rejects.toThrow('already used')
})
it('dispatch rechecks opt-out and cancellation, and locks valid jobs so a second worker cannot claim again',async()=>{
 await db.exec(`RESET ROLE;UPDATE profiles SET expo_push_token='ExponentPushToken[fixture]' WHERE id='${u1}';UPDATE notification_preferences SET push_enabled=false WHERE user_id='${u1}';UPDATE thabaat_notifications.outbox SET available_at=now()-interval '1 minute' WHERE kind='announcement';SET ROLE service_role;`)
 expect((await db.query<{jobs:unknown[]}>('SELECT claim_due_notification_jobs(20) AS jobs')).rows[0].jobs).toEqual([])
 expect((await db.query("SELECT status FROM thabaat_notifications.outbox WHERE kind='announcement'")).rows).toEqual([{status:'suppressed'}])
 await db.exec(`RESET ROLE;UPDATE notification_preferences SET push_enabled=true WHERE user_id='${u1}';UPDATE thabaat_notifications.outbox SET available_at=now()-interval '1 minute' WHERE kind='day';SET ROLE service_role;`)
 const jobs=(await db.query<{jobs:{id:string}[]}>('SELECT claim_due_notification_jobs(20) AS jobs')).rows[0].jobs
 expect(jobs).toHaveLength(1)
 expect((await db.query<{jobs:unknown[]}>('SELECT claim_due_notification_jobs(20) AS jobs')).rows[0].jobs).toEqual([])
 await db.query("SELECT complete_notification_job($1,'uncertain')",[jobs[0].id])
 expect((await db.query<{jobs:unknown[]}>('SELECT claim_due_notification_jobs(20) AS jobs')).rows[0].jobs).toEqual([])
})
it('media publication queues only verified active opted-in members and unpublication suppresses queued video',async()=>{
 await db.exec(`RESET ROLE;ALTER TABLE events ADD COLUMN timezone text;CREATE TABLE media_items(id uuid PRIMARY KEY,title text,published boolean);GRANT SELECT ON media_items TO service_role;`)
 const sql=await readFile(new URL('../database/migrations/20261005005512_notification_media_timezone.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 await db.exec(`UPDATE notification_preferences SET video_alerts=true WHERE user_id='${u1}';
 INSERT INTO memberships VALUES('50000000-0000-0000-0000-000000000001','${u1}','active',now()-interval '1 day',now()-interval '1 day',now()+interval '30 days');
 INSERT INTO media_items VALUES('60000000-0000-0000-0000-000000000001','Fixture published video',true);
 UPDATE media_items SET published=true;`)
 expect((await db.query("SELECT count(*)::int AS count FROM thabaat_notifications.outbox WHERE kind='video'")).rows).toEqual([{count:1}])
 await db.exec('UPDATE media_items SET published=false;SET ROLE service_role;')
 const jobs=(await db.query<{jobs:{kind:string}[]}>('SELECT claim_due_notification_jobs(20) AS jobs')).rows[0].jobs
 expect(jobs.some(job=>job.kind==='video')).toBe(false)
 expect((await db.query("SELECT status FROM thabaat_notifications.outbox WHERE kind='video'")).rows).toEqual([{status:'suppressed'}])
})
it('morning cadence skips unknown venue timezone and schedules 9am at explicitly configured venue',async()=>{
 await db.exec(`RESET ROLE;UPDATE notification_preferences SET reminders=ARRAY['morning'] WHERE user_id='${u1}';
 INSERT INTO events(id,event_date,title,timezone) VALUES('10000000-0000-0000-0000-000000000002',(current_date+10+time '12:00') AT TIME ZONE 'America/New_York','Configured venue fixture','America/New_York');
 INSERT INTO registrations VALUES('20000000-0000-0000-0000-000000000003','${u1}','10000000-0000-0000-0000-000000000002','confirmed');SET ROLE service_role;`)
 expect((await db.query('SELECT schedule_notification_jobs() AS added')).rows).toEqual([{added:1}]) // explicit morning consent only
 expect((await db.query("SELECT count(*)::int AS count, min(EXTRACT(hour FROM available_at AT TIME ZONE 'America/New_York'))::int AS hour FROM thabaat_notifications.outbox WHERE kind='morning'")).rows).toEqual([{count:1,hour:9}])
 expect((await db.query('SELECT schedule_notification_jobs() AS added')).rows).toEqual([{added:0}])
})
it('assigned-volunteer targeting requires event and rechecks revocation between review and queue',async()=>{
 await db.exec(`RESET ROLE;UPDATE notification_preferences SET categories=ARRAY['conferences'] WHERE user_id='${u2}';INSERT INTO volunteer_assignments VALUES('${u2}','10000000-0000-0000-0000-000000000001',true);`)
 await asUser()
 await expect(db.query("SELECT review_notification_broadcast('conferences',NULL,false,true)")).rejects.toThrow('Choose an event')
 expect((await db.query("SELECT review_notification_broadcast('conferences','10000000-0000-0000-0000-000000000001',false,true) AS count")).rows).toEqual([{count:1}])
 await db.exec('RESET ROLE;UPDATE volunteer_assignments SET active=false;');await asUser()
 expect((await db.query("SELECT queue_notification_broadcast('40000000-0000-0000-0000-000000000002','conferences','10000000-0000-0000-0000-000000000001',false,'Fixture volunteer','Local synthetic fixture',true) AS queued")).rows).toEqual([{queued:0}])
})
it('future verification cannot qualify as paid audience and timezone edits suppress scheduled morning',async()=>{
 await db.exec(`RESET ROLE;UPDATE memberships SET verified_at=now()+interval '1 day';INSERT INTO media_items VALUES('60000000-0000-0000-0000-000000000002','Unverified audience video',true);`)
 expect((await db.query("SELECT count(*)::int AS count FROM thabaat_notifications.outbox WHERE dedupe_key LIKE 'video:60000000-0000-0000-0000-000000000002:%'")).rows).toEqual([{count:0}])
 await asUser();expect((await db.query("SELECT review_notification_broadcast('conferences',NULL,true,false) AS count")).rows).toEqual([{count:0}])
 await db.exec(`RESET ROLE;UPDATE events SET timezone='America/Los_Angeles' WHERE id='10000000-0000-0000-0000-000000000002';UPDATE thabaat_notifications.outbox SET available_at=now()-interval '1 minute' WHERE kind='morning';SET ROLE service_role;`)
 expect((await db.query<{jobs:unknown[]}>('SELECT claim_due_notification_jobs(20) AS jobs')).rows[0].jobs).toEqual([])
 expect((await db.query("SELECT status FROM thabaat_notifications.outbox WHERE kind='morning'")).rows).toEqual([{status:'suppressed'}])
})
