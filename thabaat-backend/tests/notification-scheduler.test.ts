import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {SupabaseClient} from '@supabase/supabase-js'
import {startNotificationScheduler} from '../src/notifications/scheduler'
test('scheduler runs immediately, never overlaps and logs failures without crashing',async()=>{
 let claims=0;const logs:string[]=[]
 const client={rpc:async(name:string)=>{if(name==='claim_due_notification_jobs'){claims++;await new Promise(r=>setTimeout(r,30))}return{data:name==='claim_due_notification_jobs'?[]:null,error:null}}} as unknown as SupabaseClient
 const stop=startNotificationScheduler(client,async()=>[],5,m=>logs.push(m))
 await new Promise(r=>setTimeout(r,25));stop()
 assert.equal(claims,1)
 const failing={rpc:async()=>({data:null,error:{message:'offline'}})} as unknown as SupabaseClient
 const stop2=startNotificationScheduler(failing,async()=>[],1000,m=>logs.push(m))
 await new Promise(r=>setTimeout(r,10));stop2()
 assert.match(logs.join('\n'),/run failed/)
})
