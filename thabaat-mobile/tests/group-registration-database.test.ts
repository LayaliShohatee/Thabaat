/// <reference types="node" />
import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import {beforeAll,afterAll,it,expect} from 'vitest'
// Migration 20261026120000_group_registration on an isolated engine with every local migration applied in order.
let db:PGlite
const admin='00000000-0000-0000-0000-000000000001',member='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003'
let event:string,ticket:string,otherEvent:string
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
const guest=(first:string,extra:Record<string,unknown>={})=>({ticket_type_id:ticket,self:false,first_name:first,last_name:'Guest',email:`${first.toLowerCase()}@example.invalid`,age:'27',gender:'female',...extra})
const answers={heard_from:'Friend Referral',first_event:false}
const reserve=(tickets:unknown[],ans:unknown=answers,ev=event)=>db.query<{v:{order_id:string,registration_ids:string[]}}>('SELECT reserve_free_tickets($1,$2,$3) AS v',[ev,JSON.stringify(tickets),JSON.stringify(ans)])
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT ON storage.objects TO authenticated;`)
 await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'))
 const directory=new URL('../database/migrations/',import.meta.url)
 for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,directory),'utf8'))
 await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[admin,'admin@example.invalid',JSON.stringify({full_name:'Admin'})])
 await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[member,'member@example.invalid',JSON.stringify({full_name:'Member Person',gender:'female',birth_year:'1999'})])
 await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[other,'other@example.invalid',JSON.stringify({full_name:'Other',gender:'robot',birth_year:'12'})])
 await db.query("INSERT INTO staff_roles VALUES($1,'admin')",[admin])
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated;GRANT SELECT ON registrations TO authenticated')
 await as(admin)
 event=(await db.query<{id:string}>("SELECT save_managed_event(null,'Qiyam fixture','',now()+interval '1 hour','Fixture',4) AS id")).rows[0].id
 otherEvent=(await db.query<{id:string}>("SELECT save_managed_event(null,'Other fixture','',now()+interval '1 hour','Fixture',4) AS id")).rows[0].id
 ticket=(await db.query<{id:string}>('SELECT id FROM ticket_types WHERE event_id=$1',[event])).rows[0].id
},30000)
afterAll(async()=>await db?.close())

it('sign-up metadata fills valid age and gender and ignores invalid values',async()=>{
 await db.exec('RESET ROLE')
 const rows=(await db.query<{id:string,gender:string|null,birth_year:number|null}>('SELECT id,gender,birth_year FROM profiles WHERE id IN ($1,$2) ORDER BY id',[member,other])).rows
 expect(rows).toEqual([{id:member,gender:'female',birth_year:1999},{id:other,gender:null,birth_year:null}])
})

it('a self ticket needs a complete profile, which complete_my_profile provides',async()=>{
 await as(other)
 await expect(reserve([{ticket_type_id:ticket,self:true}])).rejects.toThrow(/age and gender/)
 await expect(db.query("SELECT complete_my_profile(9,'male')")).rejects.toThrow(/13 to 120/)
 await db.query("SELECT complete_my_profile(30,'male')")
 await db.exec('RESET ROLE');expect((await db.query<{gender:string}>('SELECT gender FROM profiles WHERE id=$1',[other])).rows[0].gender).toBe('male')
})

it('one booking holds the account holder plus guests, with answers saved once',async()=>{
 await as(member)
 await expect(reserve([{ticket_type_id:ticket,self:true}],{heard_from:'',first_event:true})).rejects.toThrow(/heard/)
 await expect(reserve([guest('Amina',{email:'nope'})])).rejects.toThrow(/valid email/)
 await expect(reserve([{ticket_type_id:ticket,self:true},{ticket_type_id:ticket,self:true}])).rejects.toThrow(/Only one/)
 const order=(await reserve([{ticket_type_id:ticket,self:true},guest('Amina')])).rows[0].v
 expect(order.registration_ids).toHaveLength(2)
 await db.exec('RESET ROLE')
 const rows=(await db.query<{is_self:boolean,attendee_first_name:string|null,attendee_gender:string,attendee_birth_year:number}>('SELECT is_self,attendee_first_name,attendee_gender,attendee_birth_year FROM registrations WHERE order_id=$1 ORDER BY is_self DESC',[order.order_id])).rows
 expect(rows[0]).toMatchObject({is_self:true,attendee_first_name:null,attendee_gender:'female',attendee_birth_year:1999})
 expect(rows[1]).toMatchObject({is_self:false,attendee_first_name:'Amina',attendee_gender:'female'})
 expect((await db.query('SELECT heard_from,first_event,social_time FROM registration_answers WHERE order_id=$1',[order.order_id])).rows).toEqual([{heard_from:'Friend Referral',first_event:false,social_time:null}])
 await as(member)
 await expect(reserve([{ticket_type_id:ticket,self:true}])).rejects.toThrow(/already have a ticket for yourself/)
})

it('capacity applies to every ticket in a booking and the social-time question is enforced when switched on',async()=>{
 await as(admin);await db.query('SELECT set_event_social_question($1,true)',[event])
 await as(member)
 await expect(reserve([guest('Sara')])).rejects.toThrow(/social time/)
 await reserve([guest('Sara')],{...answers,social_time:true})
 await expect(reserve([guest('Huda'),guest('Noor')],{...answers,social_time:false})).rejects.toThrow(/sold out/) // 3 of 4 seats used
 await db.exec('RESET ROLE');expect(Number((await db.query<{n:string}>('SELECT count(*) AS n FROM registrations WHERE event_id=$1',[event])).rows[0].n)).toBe(3)
 await as(other);await expect(db.query('SELECT set_event_social_question($1,false)',[event])).rejects.toThrow(/not permitted/)
})

it('legacy single bookings stay one per account per event',async()=>{
 await db.exec('RESET ROLE')
 await db.query("INSERT INTO registrations(user_id,event_id,ticket_type_id,status) VALUES($1,$2,(SELECT id FROM ticket_types WHERE event_id=$2),'confirmed')",[other,otherEvent])
 await expect(db.query("INSERT INTO registrations(user_id,event_id,ticket_type_id,status) VALUES($1,$2,(SELECT id FROM ticket_types WHERE event_id=$2),'confirmed')",[other,otherEvent])).rejects.toThrow()
})

it('scanning any ticket shows the whole booking, checks in selected or all, and keeps first check-in times',async()=>{
 await as(member)
 const ids=(await db.query<{id:string}>('SELECT id FROM registrations WHERE user_id=$1 AND event_id=$2 ORDER BY is_self DESC,created_at',[member,event])).rows.map(r=>r.id)
 const token=(await db.query<{v:{token:string}}>('SELECT get_my_ticket($1) AS v',[ids[2]])).rows[0].v.token
 await expect(db.query("SELECT check_in_party($1,$2,'{}')",[event,token])).rejects.toThrow(/staff/)
 await as(admin)
 type Party={account_name:string,tickets:{registration_id:string,full_name:string,checked_in_at:string|null,just_checked_in:boolean}[]}
 const preview=(await db.query<{v:Party}>("SELECT check_in_party($1,$2,'{}') AS v",[event,token])).rows[0].v
 expect(preview.account_name).toBe('Member Person')
 expect(preview.tickets.map(t=>t.full_name)).toEqual(['Member Person','Amina Guest','Sara Guest'])
 expect(preview.tickets.every(t=>t.checked_in_at===null)).toBe(true)
 const one=(await db.query<{v:Party}>('SELECT check_in_party($1,$2,$3) AS v',[event,token,[ids[1]]])).rows[0].v
 expect(one.tickets.filter(t=>t.just_checked_in).map(t=>t.full_name)).toEqual(['Amina Guest'])
 const first=one.tickets.find(t=>t.registration_id===ids[1])!.checked_in_at
 const all=(await db.query<{v:Party}>('SELECT check_in_party($1,$2) AS v',[event,token])).rows[0].v
 expect(all.tickets.filter(t=>t.just_checked_in)).toHaveLength(2)
 expect(all.tickets.find(t=>t.registration_id===ids[1])!.checked_in_at).toBe(first)
 await expect(db.query('SELECT check_in_party($1,$2)',[otherEvent,token])).rejects.toThrow(/another event/)
 await expect(db.query('SELECT check_in_party($1,$2,$3)',[event,token,['00000000-0000-0000-0000-00000000dead']])).rejects.toThrow(/not part of this booking/)
 const roster=(await db.query<{v:{people:{full_name:string}[]}}>("SELECT event_checkin_roster($1,'amina') AS v",[event])).rows[0].v
 expect(roster.people.map(p=>p.full_name)).toEqual(['Amina Guest'])
})

it('volunteer interest form enforces the client questions and the 23+ rule',async()=>{
 const valid={email:'v@example.invalid',name:'Volunteer',age:'27',gender:'female',phone:'555-0100',city_state:'Detroit, MI',profession:'Teacher',experience:'Food bank',why_join:'To help the community',
  hours_per_month:['3-5 Hours'],attendance_frequency:'1-3 sessions/events',available_days:['Friday'],contribute_as:['General Volunteer (minimum 1 event attended per month)'],anchor_programs:['Not Applicable'],contact_method:'Email'}
 await as(member)
 await expect(db.query('SELECT submit_volunteer_interest($1)',[JSON.stringify({...valid,age:'22'})])).rejects.toThrow(/23 or older/)
 await expect(db.query('SELECT submit_volunteer_interest($1)',[JSON.stringify({...valid,available_days:[]})])).rejects.toThrow(/required/)
 await expect(db.query('SELECT submit_volunteer_interest($1,$2)',[JSON.stringify(valid),`${other}/${'a'.repeat(32)}.pdf`])).rejects.toThrow(/resume/)
 await db.query('SELECT submit_volunteer_interest($1,$2)',[JSON.stringify(valid),`${member}/${'a'.repeat(32)}.pdf`])
 await as(member);await expect(db.query('SELECT list_volunteer_applications()')).rejects.toThrow(/Administrator/)
 await as(admin)
 const list=(await db.query<{v:{answers:{why_join:string,age:number},resume_path:string,status:string}[]}>('SELECT list_volunteer_applications() AS v')).rows[0].v
 expect(list[0]).toMatchObject({status:'submitted',answers:{why_join:'To help the community',age:27},resume_path:`${member}/${'a'.repeat(32)}.pdf`})
})

it('every function this migration defines or replaces keeps the suspended-account guard',async()=>{
 await db.exec('RESET ROLE')
 const names=['complete_my_profile','set_event_social_question','reserve_free_tickets','check_in_party','get_my_ticket','event_checkin_roster','check_in_registration','get_event_attendees','submit_volunteer_interest','list_volunteer_applications']
 const rows=(await db.query<{proname:string}>("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY($1) AND p.prosrc NOT LIKE '%assert_active_account%'",[names])).rows
 expect(rows).toEqual([])
})

it('approving an in-app application gives the Volunteer role, which unlocks event volunteering',async()=>{
 const signUp=()=>db.query<{v:string}>("SELECT sign_up_to_volunteer($1,'Whole event','Greeter','') AS v",[event])
 await as(member);await expect(signUp()).rejects.toThrow(/approved volunteers/)
 await as(admin);await db.query("SELECT review_volunteer_application($1,'declined')",[member])
 await db.exec('RESET ROLE');expect((await db.query('SELECT role FROM staff_roles WHERE user_id=$1',[member])).rows).toEqual([])
 await as(admin);await db.query("SELECT review_volunteer_application($1,'approved')",[member])
 await db.exec('RESET ROLE')
 expect((await db.query('SELECT role FROM staff_roles WHERE user_id=$1',[member])).rows).toEqual([{role:'volunteer'}])
 expect((await db.query("SELECT previous_role,new_role FROM role_audit WHERE target_id=$1",[member])).rows).toEqual([{previous_role:null,new_role:'volunteer'}])
 await as(member);expect((await signUp()).rows[0].v).toBe('requested')
 await as(member);await expect(db.query("SELECT review_volunteer_application($1,'approved')",[member])).rejects.toThrow(/Administrator/)
})

it('approval never downgrades an existing organizer or admin',async()=>{
 await db.exec('RESET ROLE');await db.query("INSERT INTO staff_roles VALUES($1,'organizer') ON CONFLICT(user_id) DO UPDATE SET role='organizer'",[other])
 await db.query("INSERT INTO volunteer_applications(user_id,motivation) VALUES($1,'Happy to help out') ON CONFLICT(user_id) DO NOTHING",[other])
 await as(admin);await db.query("SELECT review_volunteer_application($1,'approved')",[other])
 await db.exec('RESET ROLE');expect((await db.query('SELECT role FROM staff_roles WHERE user_id=$1',[other])).rows).toEqual([{role:'organizer'}])
})

it('organizers set ticket prices; a price locks once the ticket is booked or bought',async()=>{
 const save=(id:string|null,price:number|string)=>db.query<{id:string}>("SELECT save_ticket_type($1,$2,'Women (Ages 23+)','',20,$3) AS id",[event,id,price])
 await as(member);await expect(save(null,5)).rejects.toThrow(/not permitted/)
 await as(admin)
 await expect(save(null,-1)).rejects.toThrow(/price/)
 await expect(save(null,'5.555')).rejects.toThrow(/price/)
 const paid=(await save(null,'5.50')).rows[0].id
 await db.exec('RESET ROLE');expect(Number((await db.query<{price:string}>('SELECT price FROM ticket_types WHERE id=$1',[paid])).rows[0].price)).toBe(5.5)
 await as(admin);await save(paid,7)
 await expect(save(ticket,3)).rejects.toThrow(/can’t change after people have booked/) // the fixture ticket already has bookings
 await save(ticket,0) // unchanged price still saves name and quantity
})
