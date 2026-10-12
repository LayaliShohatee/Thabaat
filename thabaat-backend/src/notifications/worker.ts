import type {SupabaseClient} from '@supabase/supabase-js'
import {Expo} from 'expo-server-sdk'
import type {SendPush} from '../routes/notify'
export type NotificationJob={id:string;kind:string;token:string;title:string;body:string;eventId:string|null}
// Service-only RPC atomically locks jobs and rechecks consent, registration, event date,
// active verified membership and broadcast segment immediately before claim.
// Never automatically retry ambiguous network outcomes or abandoned dispatch claims.
export async function dispatchDueNotifications(client:SupabaseClient,send:SendPush,limit=20):Promise<{accepted:number;failed:number;uncertain:number}> {
 const {error:scheduleError}=await client.rpc('schedule_notification_jobs')
 if(scheduleError) throw new Error('Unable to schedule notification jobs')
 // Volunteer shift reminders (24 h ahead). Older databases without the function are skipped.
 const shifts=await client.rpc('schedule_volunteer_shift_reminders')
 if(shifts?.error&&shifts.error.code!=='PGRST202') throw new Error('Unable to schedule volunteer shift reminders')
 const {data,error}=await client.rpc('claim_due_notification_jobs',{p_limit:limit})
 if(error || !Array.isArray(data)) throw new Error('Unable to claim notification jobs')
 const totals={accepted:0,failed:0,uncertain:0}
 for(const job of data as NotificationJob[]) {
  let outcome:'accepted'|'failed'|'uncertain'='uncertain'
  try {
   if(!Expo.isExpoPushToken(job.token)) outcome='failed'
   else {
    const result=await send([{to:job.token,title:job.title,body:job.body,sound:'default',data:{eventId:job.eventId,notificationId:job.id}}])
    outcome=result.length===1&&result[0].status==='ok'?'accepted':'failed'
   }
  }catch{outcome='uncertain'}
  const {error:recordError}=await client.rpc('complete_notification_job',{p_id:job.id,p_status:outcome})
  if(recordError) throw new Error('Notification outcome could not be recorded. Do not retry automatically.')
  totals[outcome]++
 }
 return totals
}
