import {supabase} from '@/lib/supabase'
export type BroadcastDraft={category:string;eventId:string|null;membersOnly:boolean;volunteerOnly:boolean;title:string;body:string}
function countResult(data:unknown):number{if(typeof data!=='number'||!Number.isSafeInteger(data)||data<0)throw new Error('Broadcast result could not be verified. Retry the same request.');return data}
export async function reviewBroadcast(draft:BroadcastDraft):Promise<number>{
 const {data,error}=await supabase.rpc('review_notification_broadcast',{p_category:draft.category,p_event_id:draft.eventId,p_members_only:draft.membersOnly,p_volunteer_only:draft.volunteerOnly})
 if(error)throw new Error(error.message)
 return countResult(data)
}
export async function queueBroadcast(id:string,draft:BroadcastDraft):Promise<number>{
 const {data,error}=await supabase.rpc('queue_notification_broadcast',{p_id:id,p_category:draft.category,p_event_id:draft.eventId,p_members_only:draft.membersOnly,p_title:draft.title,p_body:draft.body,p_volunteer_only:draft.volunteerOnly})
 if(error)throw new Error(error.message)
 return countResult(data)
}

export async function newBroadcastId():Promise<string>{
 const {data,error}=await supabase.rpc('new_notification_broadcast_id')
 if(error||typeof data!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data))throw new Error('Unable to prepare immutable broadcast request.')
 return data
}
