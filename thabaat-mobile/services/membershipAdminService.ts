import { supabase } from '@/lib/supabase'
import type { Membership, Plan } from '@/lib/billing'
export type AdminPlan=Plan & {acquisition_mode:'charitystack'|'complimentary';revision:number;in_use?:boolean}
export type MembershipRow={user_id:string;full_name:string;plan_name:string;status:Membership['status'];source:Membership['source'];starts_at:string;expires_at:string;cancel_at_period_end:boolean;active:boolean}
export type MembershipAudit={id:string;target_user_id:string|null;plan_id:string;action:string;reason:string;recorded_at:string;actor_name:string;previous_record:Record<string,unknown>|null;new_record:Record<string,unknown>}
export type MembershipAdminReport={memberships:MembershipRow[];history:MembershipAudit[];history_limit:number;counts:{recorded:number;active:number;past_due:number;ending_30_days:number}}
export type PlanInput={id:string|null;revision:number|null;name:string;description:string;benefits:string[];mode:AdminPlan['acquisition_mode'];amountCents:number|null;period:Plan['billing_period'];checkoutUrl:string|null;published:boolean;reason:string}
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.code==='PGRST202'?'Membership administration setup is not installed on this database.':error.message);return data as T}
export const getAdminPlans=()=>rpc<AdminPlan[]>('admin_membership_catalog')
export const getMembershipAdminReport=(search='')=>rpc<MembershipAdminReport>('admin_membership_report',{p_search:search})
export const saveAdminPlan=(p:PlanInput)=>rpc<AdminPlan>('save_membership_plan',{p_id:p.id,p_revision:p.revision,p_name:p.name,p_description:p.description,p_benefits:p.benefits,p_mode:p.mode,p_amount_cents:p.amountCents,p_period:p.period,p_checkout_url:p.checkoutUrl,p_published:p.published,p_reason:p.reason})
export const issueComplimentaryMembership=(p:{userId:string;planId:string;expiresAt:string;reason:string;requestId:string})=>rpc<Membership>('issue_complimentary_membership',{p_user_id:p.userId,p_plan_id:p.planId,p_expires_at:p.expiresAt,p_reason:p.reason,p_request_id:p.requestId})
export const revokeComplimentaryMembership=(userId:string,reason:string)=>rpc<void>('revoke_complimentary_membership',{p_user_id:userId,p_reason:reason})
