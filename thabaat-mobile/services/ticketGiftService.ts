import { supabase } from '@/lib/supabase'
export type TicketGift={id:string;registration_id:string;event_id:string;sender_id:string;recipient_id:string;recipient_registration_id:string|null;status:'pending'|'accepted'|'declined'|'revoked'|'expired';expires_at:string;created_at:string;title:string;event_date:string;members_only:boolean;sender_name:string;recipient_name:string}
export type GiftableRegistration={id:string;event_id:string;title:string;event_date:string;ticket_name:string;members_only:boolean}
export type TicketGiftInbox={gifts:TicketGift[];registrations:GiftableRegistration[]}
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.code==='PGRST202'?'Ticket gifts require a staging update before they can be used.':error.message);return data as T}
export const getTicketGifts=()=>rpc<TicketGiftInbox>('my_free_ticket_gifts')
export const beginTicketGift=(p:{registrationId:string;recipientId:string;requestId:string})=>rpc<TicketGift>('begin_free_ticket_gift',{p_registration_id:p.registrationId,p_recipient_id:p.recipientId,p_request_id:p.requestId})
export const acceptTicketGift=(giftId:string)=>rpc<TicketGift>('accept_free_ticket_gift',{p_gift_id:giftId})
export const resolveTicketGift=(giftId:string,action:'revoked'|'declined')=>rpc<void>('resolve_free_ticket_gift',{p_gift_id:giftId,p_action:action})
