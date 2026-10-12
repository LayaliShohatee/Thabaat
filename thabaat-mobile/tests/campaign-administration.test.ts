/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest'
let db:PGlite
const admin='00000000-0000-0000-0000-000000000001',organizer='00000000-0000-0000-0000-000000000002',member='00000000-0000-0000-0000-000000000003'
async function as(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')}
async function create(id:string|null=null,capacity=10){return (await db.query<{id:string}>("SELECT save_managed_event($1,'Local event','Test description',now()+interval '30 days','Test venue',$2) AS id",[id,capacity])).rows[0].id}
beforeAll(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`)
 for(const file of ['schema.sql','migrations/20260921_prototype_integrity.sql','migrations/20260928_membership_billing.sql','migrations/20260928_paid_event_test.sql','migrations/20260929_events_permissions.sql','migrations/20260929_events_permissions.sql','migrations/20261005012003_campaign_administration.sql','migrations/20261005012003_campaign_administration.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'))
 await db.query("INSERT INTO auth.users VALUES($1,'admin@example.invalid','{}'),($2,'organizer@example.invalid','{}'),($3,'member@example.invalid','{}')",[admin,organizer,member])
 await db.exec('GRANT SELECT ON events,ticket_types TO authenticated; GRANT SELECT,INSERT ON registrations TO authenticated')
},30000)
beforeEach(async()=>{await db.exec('RESET ROLE; TRUNCATE campaign_audit,payment_records,donation_campaigns,memberships,membership_plans,role_audit,staff_roles,registrations,paid_event_orders,event_access_details,paid_event_checkout_configs,ticket_types,events CASCADE');await db.query("INSERT INTO staff_roles VALUES($1,'admin'),($2,'organizer')",[admin,organizer]);await as(member)})
afterAll(async()=>{await db?.close()})


const campaign=(id:string|null=null,revision:number|null=null,featured=false)=>db.query<{c:{id:string,revision:number}}>("SELECT to_jsonb(save_campaign($1,$2,'Approved campaign','Terms supplied by team','https://charitystack.com/donate/test-form',false,10000,true,$3,'Approved campaign setup')) AS c",[id,revision,featured]).then(r=>r.rows[0].c)
it('campaign writes and donor reports deny regular users, organizers and direct table bypass',async()=>{
 await expect(campaign()).rejects.toThrow('Administrator');await expect(db.query('SELECT admin_donation_report(now(),0)')).rejects.toThrow('Administrator');await as(organizer);await expect(campaign()).rejects.toThrow('Administrator');await expect(db.query('SELECT admin_campaign_catalog()')).rejects.toThrow('Administrator');await as(admin);await expect(db.query("UPDATE donation_campaigns SET raised_cents=100000")).rejects.toThrow('permission denied');
})
it('audits optimistic campaign changes, single-feature replacement, archives without deleting financial history',async()=>{
 await as(admin);const first=await campaign(null,null,true),second=await campaign(null,null,true);
 expect((await db.query<{v:unknown}>('SELECT admin_campaign_catalog() AS v')).rows[0].v).toEqual(expect.arrayContaining([expect.objectContaining({id:first.id,featured:false,revision:2}),expect.objectContaining({id:second.id,featured:true})]));
 await expect(campaign(first.id,1)).rejects.toThrow('changed');await db.query('SELECT archive_campaign($1,1,$2)',[second.id,'Campaign has closed']);await as(member);
 expect((await db.query<{v:{id:string}[]}>('SELECT campaign_listing() AS v')).rows[0].v.map(c=>c.id)).toEqual([first.id]);
 await db.exec('RESET ROLE');expect((await db.query('SELECT count(*)::integer AS count FROM campaign_audit')).rows[0]).toEqual({count:4});
})
it('rejects unsafe provider URLs, negative goals and invalid featured drafts',async()=>{
 await as(admin);const save="SELECT save_campaign(null,null,'Campaign','', $1,false,$2,$3,$4,'Valid reason')";
 await expect(db.query(save,['https://charitystack.com.evil.invalid/donate/test',100,true,false])).rejects.toThrow('CharityStack');await expect(db.query(save,['https://charitystack.com/donate/test?token=secret',100,true,false])).rejects.toThrow('CharityStack');await expect(db.query(save,['https://charitystack.com/donate/test',-1,true,false])).rejects.toThrow('goal');await expect(db.query(save,['https://charitystack.com/donate/test',100,false,true])).rejects.toThrow('Publish');
})
it('public goals sum only correlated verified completed donations and exports do not infer campaign from descriptions',async()=>{
 await as(admin);const c=await campaign();await db.exec('RESET ROLE');await db.query('UPDATE donation_campaigns SET raised_cents=999999 WHERE id=$1',[c.id]);
 const add=async(status:string,purpose='donation',campaignId:string|null=c.id,verified="now()-interval '1 hour'")=>db.query(`INSERT INTO payment_records(user_id,provider_payment_id,purpose,description,amount_cents,currency,status,paid_at,verified_at,campaign_id) VALUES($1,gen_random_uuid()::text,$2,'Approved campaign',500,'USD',$3,now()-interval '2 hours',${verified},$4)`,[member,purpose,status,campaignId]);
 await add('completed');await add('pending');await add('failed');await add('refunded');await add('completed','event');await add('completed','donation',null);await add('completed','donation',c.id,"now()+interval '1 hour'");
 await as(member);expect((await db.query<{v:{raised_cents:number}[]}>('SELECT campaign_listing() AS v')).rows[0].v[0].raised_cents).toBe(500);
 await as(admin);const report=(await db.query<{v:{total:number;records:{campaign:string}[]}}>('SELECT admin_donation_report(now(),0) AS v')).rows[0].v;expect(report.total).toBe(2);expect(report.records.map(r=>r.campaign)).toContain('Unattributed');
 await expect(db.query("SELECT admin_donation_report(now()+interval '1 hour',0)")).rejects.toThrow('cutoff');await expect(db.query('SELECT admin_donation_report(now(),-1)')).rejects.toThrow('offset');
})

it('prepares a keyless draft but cannot publish it without an approved donation form',async()=>{
 await as(admin);const result=(await db.query<{c:{id:string;revision:number}}>("SELECT to_jsonb(save_campaign(null,null,'Draft campaign','Approved draft terms','',false,null,false,false,'Prepare draft terms')) AS c")).rows[0].c;
 await expect(db.query("SELECT save_campaign($1,$2,'Draft campaign','','',false,null,true,false,'Approve publication')",[result.id,result.revision])).rejects.toThrow('CharityStack');
 await as(member);expect((await db.query<{v:unknown[]}>('SELECT campaign_listing() AS v')).rows[0].v).toEqual([])
})
