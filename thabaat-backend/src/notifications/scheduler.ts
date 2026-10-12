import type {SupabaseClient} from '@supabase/supabase-js'
import type {SendPush} from '../routes/notify'
import {dispatchDueNotifications} from './worker'
// Runs the notification worker on an interval (reminders, membership alerts, new-video alerts,
// broadcasts and volunteer shift reminders). Runs never overlap; a failed run is logged and the next tick retries.
export function startNotificationScheduler(client:SupabaseClient,send:SendPush,intervalMs=60_000,log:(message:string)=>void=console.log):()=>void {
 let running=false
 const tick=async()=>{
  if(running)return
  running=true
  try{const totals=await dispatchDueNotifications(client,send);if(totals.accepted||totals.failed||totals.uncertain)log(`notifications: ${totals.accepted} sent, ${totals.failed} failed, ${totals.uncertain} uncertain`)}
  catch(error){log(`notifications: run failed (${error instanceof Error?error.message:'unknown error'})`)}
  finally{running=false}
 }
 const timer=setInterval(()=>void tick(),intervalMs)
 void tick()
 return ()=>clearInterval(timer)
}
