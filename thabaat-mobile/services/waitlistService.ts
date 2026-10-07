import { supabase } from '@/lib/supabase'
export type WaitlistEntry = { id:string; event_id:string; ticket_type_id:string; status:'waiting'|'offered'|'accepted'|'left'; joined_at:string; offer_expires_at:string|null; full_name?:string; ticket_name?:string }
export async function getOwnWaitlist(eventId:string,userId:string):Promise<WaitlistEntry|null>{
 const {data,error}=await supabase.from('event_waitlist').select('*').eq('event_id',eventId).eq('user_id',userId).maybeSingle()
 if(error)throw error;return data
}
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
export const joinWaitlist=(eventId:string,ticketId:string)=>rpc('join_event_waitlist',{p_event_id:eventId,p_ticket_type_id:ticketId})
export const leaveWaitlist=(eventId:string)=>rpc('leave_event_waitlist',{p_event_id:eventId})
export const acceptWaitlist=(eventId:string)=>rpc('accept_waitlist_offer',{p_event_id:eventId})
export const getManagedWaitlist=(eventId:string):Promise<WaitlistEntry[]>=>rpc('manage_event_waitlist',{p_event_id:eventId})
export const offerWaitlist=(eventId:string,ticketId:string,expiresAt:string)=>rpc('offer_next_waitlist_seat',{p_event_id:eventId,p_ticket_type_id:ticketId,p_expires_at:expiresAt})
