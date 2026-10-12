import { supabase } from '@/lib/supabase'
// Test-mode payments (no money moves). The database refuses every call unless an admin has turned sandbox mode on.
export type PaymentsMode='off'|'sandbox'
async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw new Error(error.code==='PGRST202'?'Test payments are not installed on this database yet.':error.message)
 return data as T
}
export async function getPaymentsMode():Promise<PaymentsMode>{try{return (await rpc<PaymentsMode>('payments_mode'))==='sandbox'?'sandbox':'off'}catch{return 'off'}}
export const setPaymentsMode=(mode:PaymentsMode)=>rpc<null>('set_payments_mode',{p_mode:mode})
export const sandboxPurchaseTicket=(ticketId:string,code:string)=>rpc<{registration_id:string;payment_id:string;charged_cents:number}>('sandbox_purchase_ticket',{p_ticket_id:ticketId,p_code:code})
export const sandboxPurchaseMembership=(planId:string)=>rpc<{payment_id:string;expires_at:string}>('sandbox_purchase_membership',{p_plan_id:planId})
export const sandboxDonate=(campaignId:string,amountCents:number)=>rpc<{payment_id:string}>('sandbox_donate',{p_campaign_id:campaignId,p_amount_cents:amountCents})
export type MonthlyGift={id:string;campaign_id:string;campaign:string;amount_cents:number;next_charge_at:string}
export const startMonthlyDonation=(campaignId:string,amountCents:number)=>rpc<string>('sandbox_start_monthly_donation',{p_campaign_id:campaignId,p_amount_cents:amountCents})
export const cancelMonthlyDonation=(id:string)=>rpc<null>('cancel_monthly_donation',{p_pledge_id:id})
export async function getMonthlyDonations():Promise<MonthlyGift[]>{try{return await rpc<MonthlyGift[]>('my_monthly_donations')}catch{return []}}
