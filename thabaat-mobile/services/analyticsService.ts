import { supabase } from '@/lib/supabase'
import { csvCell } from '@/lib/staff-reporting'
export type Analytics = {as_of:string;days:number;since:string;users:{total:number;new:number};memberships:{current_verified:number;complimentary_current:number};events:{upcoming:number;archived:number};registrations:{confirmed:number;cancelled:number;new:number;checked_in:number};verified_payments:{purpose:string;currency:string;count:number;amount_cents:number}[];daily:{day:string;new_users:number;new_registrations:number}[]}
export async function getAdminAnalytics(days:number):Promise<Analytics> {
 const {data,error}=await supabase.rpc('admin_analytics',{p_days:days})
 if(error)throw new Error(['PGRST202','42883'].includes(error.code)?'Analytics setup is not installed on this database. The tested migration needs staging review.':error.message)
 return data
}
export function analyticsCsv(report:Analytics) {
 const rows:unknown[][]=[['Report as of',report.as_of],['Window starts',report.since],['Daily timezone','UTC'],['Users total',report.users.total],['Users new in window',report.users.new],['Current verified memberships',report.memberships.current_verified],['Current complimentary memberships',report.memberships.complimentary_current],['Confirmed registrations all time',report.registrations.confirmed],['Cancelled registrations all time',report.registrations.cancelled],['Checked in all time',report.registrations.checked_in],[],['Payment purpose','Currency','Verified completed count','Amount cents']]
 for(const p of report.verified_payments)rows.push([p.purpose,p.currency,p.count,p.amount_cents])
 rows.push([],['UTC day','New users','New registrations'])
 for(const d of report.daily)rows.push([d.day,d.new_users,d.new_registrations])
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
}
