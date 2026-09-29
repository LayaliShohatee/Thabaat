import { supabase } from '@/lib/supabase'
import type { Event } from '@/types'
export type StaffRole = 'volunteer' | 'organizer' | 'admin'
export type Permissions = { user_id: string; staff_role: StaffRole | null; can_manage_events: boolean; can_manage_roles: boolean; paid_member: boolean }
export type RoleAccount = { user_id: string; full_name: string; email: string; staff_role: StaffRole | null }
export type ManagedEvent = Event & { created_by?: string | null; archived?: boolean }
export type EventAttendees = {
 attendees: { registration_id:string; full_name:string; ticket_name:string; status:'confirmed'|'pending'|'cancelled'; registered_at:string }[]
 counts: { total:number; confirmed:number; pending:number; cancelled:number }
 capacity:number; reserved:number
}
export async function getEventAttendees(eventId:string,offset=0):Promise<EventAttendees> {
 const {data,error}=await supabase.rpc('get_event_attendees',{p_event_id:eventId,p_offset:offset})
 if(error) throw failure(error)
 return data
}
function failure(error: { code?: string; message: string }) {
 if (['PGRST202','42P01','42703'].includes(error.code || '')) return new Error('Events and permissions setup is not yet installed on this database. Ask the team to apply the events/permissions migration.')
 return new Error(error.message)
}
export async function getPermissions(): Promise<Permissions> {
 const { data,error } = await supabase.rpc('my_permissions')
 if(error) throw failure(error)
 return data
}
export async function getManagementEvents(): Promise<ManagedEvent[]> {
 const {data,error}=await supabase.from('events').select('*').order('event_date',{ascending:true})
 if(error) throw failure(error)
 return (data || []).filter(event => !event.archived)
}
export async function saveEvent(input: { id: string | null; title: string; description: string; date: string; location: string; capacity: number }) {
 const {data,error}=await supabase.rpc('save_managed_event',{p_id:input.id,p_title:input.title,p_description:input.description,p_date:input.date,p_location:input.location,p_capacity:input.capacity})
 if(error) throw failure(error)
 return data as string
}
export async function archiveEvent(id:string) {
 const {error}=await supabase.rpc('archive_managed_event',{p_id:id})
 if(error) throw failure(error)
}
export async function searchRoleAccounts(search:string):Promise<RoleAccount[]> {
 const {data,error}=await supabase.rpc('search_role_accounts',{p_search:search})
 if(error) throw failure(error)
 return data || []
}
export async function setStaffRole(userId:string,role:StaffRole|null) {
 const {error}=await supabase.rpc('set_staff_role',{p_user_id:userId,p_role:role})
 if(error) throw failure(error)
}
