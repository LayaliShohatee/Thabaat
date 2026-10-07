import { supabase } from '@/lib/supabase'
import type { Campaign } from '@/lib/billing'
import { csvCell } from '@/lib/staff-reporting'
export type AdminCampaign=Campaign & {published:boolean;archived:boolean;featured:boolean;revision:number}
export type CampaignInput={id:string|null;revision:number|null;name:string;description:string;checkoutUrl:string;recurring:boolean;goalCents:number|null;published:boolean;featured:boolean;reason:string}
export type DonationRecord={id:string;full_name:string;campaign:string;description:string;amount_cents:number;currency:string;paid_at:string;verified_at:string}
export type DonationReport={records:DonationRecord[];total:number;cutoff:string}
async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(['PGRST202','42883','42P01'].includes(error.code)?'Campaign administration setup is not installed on this database. Ask the team to apply the tested campaign migration.':error.message);return data as T}
export const getAdminCampaigns=()=>rpc<AdminCampaign[]>('admin_campaign_catalog')
export const saveCampaign=(p:CampaignInput)=>rpc<AdminCampaign>('save_campaign',{p_id:p.id,p_revision:p.revision,p_name:p.name,p_description:p.description,p_checkout_url:p.checkoutUrl,p_recurring:p.recurring,p_goal_cents:p.goalCents,p_published:p.published,p_featured:p.featured,p_reason:p.reason})
export const archiveCampaign=(p:AdminCampaign,reason:string)=>rpc<void>('archive_campaign',{p_id:p.id,p_revision:p.revision,p_reason:reason})
export const getDonationReport=(cutoff:string|null,offset=0)=>rpc<DonationReport>('admin_donation_report',{p_before:cutoff,p_offset:offset})
export async function getDonationExport(cutoff:string){
 const first=await getDonationReport(cutoff);if(first.total>10000)throw new Error('This export exceeds 10,000 records. Ask the team for a supervised larger report.')
 const records=[...first.records];while(records.length<first.total){const page=await getDonationReport(cutoff,records.length);if(page.total!==first.total||!page.records.length)throw new Error('Donation records changed during export. Refresh and try again.');records.push(...page.records)}
 if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('Donation records changed during export. Refresh and try again.')
 return records
}
export function donationCsv(records:DonationRecord[]){return [['Payment record ID','Donor name','Campaign','Description','Amount cents','Currency','Paid at','Verified at'],...records.map(r=>[r.id,r.full_name,r.campaign,r.description,r.amount_cents,r.currency,r.paid_at,r.verified_at])].map(row=>row.map(csvCell).join(',')).join('\r\n')}
