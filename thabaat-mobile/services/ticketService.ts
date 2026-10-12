import { supabase } from '@/lib/supabase'
export type TicketCredential={registration_id:string;event_id:string;title:string;event_date:string;location:string;ticket_name:string;token:string;checked_in_at:string|null}
export type CheckInResult={registration_id:string;full_name:string;ticket_name:string;checked_in_at:string;already_checked_in:boolean}
export type AttendanceReport={confirmed:number;checked_in:number;attendees:{registration_id:string;full_name:string;status:string;checked_in_at:string|null;no_show?:boolean}[];no_shows?:number;event_started?:boolean}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.code==='PGRST202'?'Ticket/check-in setup is not installed on this database.':error.message);return data as T}
export const getMyTicket=(registrationId:string)=>rpc<TicketCredential>('get_my_ticket',{p_registration_id:registrationId})
export const checkInTicket=(eventId:string,token:string)=>rpc<CheckInResult>('check_in_ticket',{p_event_id:eventId,p_token:token.trim()})
export const setNoShow=(registrationId:string,noShow:boolean)=>rpc<null>('set_no_show',{p_registration_id:registrationId,p_no_show:noShow})
export const getAttendanceReport=(eventId:string)=>rpc<AttendanceReport>('event_attendance_report',{p_event_id:eventId})
