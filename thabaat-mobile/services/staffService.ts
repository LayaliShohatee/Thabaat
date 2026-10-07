import { supabase } from '@/lib/supabase'
export type VolunteerShift = { event_id: string; title?: string; user_id?: string; full_name?: string; duty: string; shift_start: string; shift_end: string; active: boolean; reviewed_hours: number }
export type VolunteerApplication = { user_id?: string; full_name?: string; motivation: string; status: 'submitted'|'approved'|'declined' }
export type VolunteerWork = { application: VolunteerApplication|null; assignments: VolunteerShift[] }
export type StaffReport = { event: {title:string;capacity:number;event_date:string}; volunteer_candidates?: {user_id:string;full_name:string}[]; registrations: {registration_id:string;full_name:string;ticket_name:string;status:string;registered_at:string}[]; volunteers: VolunteerShift[] }
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T> {
 const {data,error}=await supabase.rpc(name,args)
 if(error) throw new Error(['PGRST202','42P01'].includes(error.code)?'Volunteer/reporting setup is not installed on this database.':error.message)
 return data as T
}
export const getVolunteerWork=()=>rpc<VolunteerWork>('my_volunteer_work')
export const submitVolunteerApplication=(motivation:string)=>rpc<void>('submit_volunteer_application',{p_motivation:motivation})
export const getVolunteerApplications=()=>rpc<VolunteerApplication[]>('list_volunteer_applications')
export const reviewVolunteerApplication=(userId:string,status:'approved'|'declined')=>rpc<void>('review_volunteer_application',{p_user_id:userId,p_status:status})
export const getStaffReport=(eventId:string)=>rpc<StaffReport>('staff_event_report',{p_event_id:eventId})
export const saveVolunteerAssignment=(input:{eventId:string;userId:string;duty:string;start:string;end:string;active:boolean;hours:number})=>rpc<void>('set_volunteer_assignment',{p_event_id:input.eventId,p_user_id:input.userId,p_duty:input.duty,p_start:input.start,p_end:input.end,p_active:input.active,p_hours:input.hours})
