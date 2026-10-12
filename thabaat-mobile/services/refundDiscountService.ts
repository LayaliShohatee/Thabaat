import { supabase } from '@/lib/supabase'
export type RefundRequest={id:string;event_id:string;event_title:string;full_name:string;ticket_name:string;price:number;reason:string;status:'requested'|'approved'|'declined';requested_at:string;reviewed_at:string|null;review_note:string|null}
export type PromoCode={id:string;event_id:string|null;code:string;percent_off:number|null;amount_off_cents:number|null;max_uses:number|null;uses:number;expires_at:string|null;active:boolean}
export type PriceQuote={base_cents:number;member_discount_percent:number;member_discount_cents:number;code_discount_cents:number;final_cents:number;code_applied:boolean;code_error:string|null}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw new Error(error.code==='PGRST202'?'Refund and discount setup is not installed on this database yet.':error.message)
 return data as T
}
export const requestRefund=(registrationId:string,reason:string)=>rpc<string>('request_refund',{p_registration_id:registrationId,p_reason:reason})
export const listRefundRequests=(eventId:string|null)=>rpc<RefundRequest[]>('list_refund_requests',{p_event_id:eventId})
export const reviewRefundRequest=(id:string,approve:boolean,note:string)=>rpc<null>('review_refund_request',{p_request_id:id,p_approve:approve,p_note:note})
export const setRefundDeadline=(eventId:string,deadline:string|null)=>rpc<null>('set_refund_deadline',{p_event_id:eventId,p_deadline:deadline})
export const listPromoCodes=(eventId:string)=>rpc<PromoCode[]>('list_promo_codes',{p_event_id:eventId})
export const savePromoCode=(eventId:string|null,input:{id:string|null;code:string;percent_off:number|null;amount_off_cents:number|null;max_uses:number|null;expires_at:string|null;active:boolean})=>
 rpc<string>('save_promo_code',{p_id:input.id,p_event_id:eventId,p_code:input.code,p_percent_off:input.percent_off,p_amount_off_cents:input.amount_off_cents,p_max_uses:input.max_uses,p_expires_at:input.expires_at,p_active:input.active})
export const quoteTicketPrice=(ticketId:string,code:string)=>rpc<PriceQuote>('quote_ticket_price',{p_ticket_id:ticketId,p_code:code})
