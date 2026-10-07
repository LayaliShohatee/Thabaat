import { supabase } from '@/lib/supabase'
export type InventoryTicket={id:string;name:string;description:string|null;price:number;quantity:number;reserved:number}
export async function getTicketInventory(eventId:string):Promise<InventoryTicket[]> {
 const {data,error}=await supabase.rpc('managed_ticket_types',{p_event_id:eventId});if(error)throw new Error(error.message);return data||[]
}
export async function saveFreeTicket(eventId:string,input:{id:string|null;name:string;description:string;quantity:number}) {
 const {error}=await supabase.rpc('save_free_ticket_type',{p_event_id:eventId,p_id:input.id,p_name:input.name,p_description:input.description,p_quantity:input.quantity});if(error)throw new Error(error.message)
}
