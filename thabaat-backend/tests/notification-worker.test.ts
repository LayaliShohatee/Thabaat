import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dispatchDueNotifications} from '../src/notifications/worker'
const job={id:'fixture-job',kind:'day',token:'ExponentPushToken[fixture]',title:'Fixture',body:'Synthetic only',eventId:'fixture-event'}
test('worker claims with limit and records accepted provider outcome only',async()=>{
 const calls:unknown[]=[]
 const client={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return{data:name==='claim_due_notification_jobs'?[job]:null,error:null}}} as unknown as SupabaseClient
 const result=await dispatchDueNotifications(client,async()=>[{status:'ok',id:'fixture-ticket'}],5)
 assert.deepEqual(result,{accepted:1,failed:0,uncertain:0})
 assert.deepEqual(calls,[['schedule_notification_jobs',undefined],['schedule_volunteer_shift_reminders',undefined],['claim_due_notification_jobs',{p_limit:5}],['complete_notification_job',{p_id:job.id,p_status:'accepted'}]])
})
test('outage records uncertain instead of a repeatable failure',async()=>{
 let recorded:unknown
 const client={rpc:async(name:string,args:unknown)=>{if(name==='complete_notification_job')recorded=args;return{data:name==='claim_due_notification_jobs'?[job]:null,error:null}}} as unknown as SupabaseClient
 assert.deepEqual(await dispatchDueNotifications(client,async()=>{throw new Error('timeout')}),{accepted:0,failed:0,uncertain:1})
 assert.deepEqual(recorded,{p_id:job.id,p_status:'uncertain'})
})
test('claim error and write error never imply completed delivery',async()=>{
 await assert.rejects(dispatchDueNotifications({rpc:async()=>({data:null,error:{message:'offline'}})} as unknown as SupabaseClient,async()=>[]),/schedule/)
 const client={rpc:async(name:string)=>name==='claim_due_notification_jobs'?{data:[job],error:null}:['schedule_notification_jobs','schedule_volunteer_shift_reminders'].includes(name)?{data:0,error:null}:{data:null,error:{message:'offline'}}} as unknown as SupabaseClient
 await assert.rejects(dispatchDueNotifications(client,async()=>[{status:'ok',id:'fixture'}]),/Do not retry/)
})
test('older databases without volunteer reminders still dispatch; other scheduling errors stop the run',async()=>{
 const missing={rpc:async(name:string)=>name==='schedule_volunteer_shift_reminders'?{data:null,error:{code:'PGRST202',message:'missing'}}:{data:name==='claim_due_notification_jobs'?[]:null,error:null}} as unknown as SupabaseClient
 assert.deepEqual(await dispatchDueNotifications(missing,async()=>[]),{accepted:0,failed:0,uncertain:0})
 const broken={rpc:async(name:string)=>name==='schedule_volunteer_shift_reminders'?{data:null,error:{code:'XX000',message:'boom'}}:{data:null,error:null}} as unknown as SupabaseClient
 await assert.rejects(dispatchDueNotifications(broken,async()=>[]),/volunteer shift/)
})
