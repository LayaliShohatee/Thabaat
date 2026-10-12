import { supabase } from '@/lib/supabase'
export type AccountControl={user_id:string;full_name:string;staff_role:string|null;suspended:boolean;revision:number}
export type AccountReview={accounts:AccountControl[];history:{id:string;target_id:string;suspended:boolean;reason:string;recorded_at:string;revision:number}[]}
export type ShiftAttendance={event_id:string;title:string;duty:string;shift_start:string;shift_end:string;active:boolean;reviewed_hours:number;arrived_at:string|null;departed_at:string|null}
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{const{data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.code==='PGRST202'?'Account review and shift attendance require a staging update.':error.message);return data as T}
export const reviewAccounts=(search:string)=>rpc<AccountReview>('admin_account_controls',{p_search:search})
export const setAccountSuspension=(account:AccountControl,suspended:boolean,reason:string)=>rpc<void>('set_account_suspension',{p_user_id:account.user_id,p_suspended:suspended,p_reason:reason,p_revision:account.revision})
export const getShiftAttendance=()=>rpc<ShiftAttendance[]>('my_volunteer_attendance')
export const recordShiftAttendance=(eventId:string,action:'arrive'|'depart')=>rpc<ShiftAttendance>('record_volunteer_attendance',{p_event_id:eventId,p_action:action})
