import { supabase } from '@/lib/supabase'
// Membership changes, plan management, reviewed public event pages and volunteer onboarding (backlog completion).
export type MembershipChangeKind='cancel_renewal'|'resume_renewal'|'change_plan'
export type MembershipChangeRequest={id:string;full_name:string;kind:MembershipChangeKind;current_plan:string|null;target_plan:string|null;status:'requested'|'completed'|'declined';requested_at:string}
export type PublicEvent={event_id:string;title:string;summary:string;event_date:string;venue:string;image_url:string|null}
export type PlanInput={id:string|null;name:string;description:string;benefits:string[];amount_cents:number|null;billing_period:'one_time'|'monthly'|'annually';checkout_url:string|null;published:boolean;ticket_discount_percent:number}
async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw new Error(error.code==='PGRST202'?'This feature is not installed on this database yet.':error.message)
 return data as T
}
export const requestMembershipChange=(kind:MembershipChangeKind,targetPlanId:string|null=null)=>rpc<string>('request_membership_change',{p_kind:kind,p_target_plan_id:targetPlanId})
export async function getMyOpenMembershipChange(){const {data,error}=await supabase.from('membership_change_requests').select('id,kind,status,requested_at').eq('status','requested').maybeSingle();if(error&&!['42P01','PGRST205'].includes(error.code))throw new Error(error.message);return data as {id:string;kind:MembershipChangeKind}|null}
export const listMembershipChangeRequests=()=>rpc<MembershipChangeRequest[]>('list_membership_change_requests')
export const reviewMembershipChange=(id:string,complete:boolean)=>rpc<null>('review_membership_change',{p_request_id:id,p_complete:complete})
export const saveMembershipPlan=(p:PlanInput)=>rpc<string>('save_membership_plan',{p_id:p.id,p_name:p.name,p_description:p.description,p_benefits:p.benefits,p_amount_cents:p.amount_cents,p_billing_period:p.billing_period,p_checkout_url:p.checkout_url,p_published:p.published,p_ticket_discount_percent:p.ticket_discount_percent})
export const listPublicEvents=()=>rpc<PublicEvent[]>('reviewed_public_events')
export async function getPublicEvent(id:string){const rows=await rpc<PublicEvent[]>('reviewed_public_event',{p_id:id});return rows[0]??null}
export const publishPublicEvent=(id:string,title:string,summary:string,venue:string,visible:boolean)=>rpc<null>('set_reviewed_public_event',{p_id:id,p_title:title,p_summary:summary,p_venue:venue,p_visible:visible})
export const ONBOARDING_STEPS:[string,string][]=[['code_of_conduct','I have read and agree to the volunteer code of conduct.'],['safety','I know the safety and emergency procedures for events.'],['check_in','I know how to check attendees in with the Thabaat scanner.'],['contact','I know who my event coordinator is and how to reach them.']]
export const getVolunteerOnboarding=()=>rpc<{approved:boolean;completed_at:string|null}>('my_volunteer_onboarding')
export const completeVolunteerOnboarding=(steps:string[])=>rpc<null>('complete_volunteer_onboarding',{p_acknowledged:steps})
