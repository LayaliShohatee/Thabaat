import { supabase } from '@/lib/supabase'
import type { TicketCategory } from '@/lib/ticket-categories'
export type InventoryTicket={id:string;name:string;description:string|null;price:number;quantity:number;reserved:number;category?:TicketCategory;sale_ends_at?:string|null}
export async function getTicketInventory(eventId:string):Promise<InventoryTicket[]> {
 const {data,error}=await supabase.rpc('managed_ticket_types',{p_event_id:eventId});if(error)throw new Error(error.message);return data||[]
}
// Price 0 is a free ticket (migration 20261026140000_paid_ticket_types).
export async function saveTicket(eventId:string,input:{id:string|null;name:string;description:string;quantity:number;price:number}):Promise<string> {
 const {data,error}=await supabase.rpc('save_ticket_type',{p_event_id:eventId,p_id:input.id,p_name:input.name,p_description:input.description,p_quantity:input.quantity,p_price:input.price});if(error)throw new Error(error.code==='PGRST202'?'Ticket prices need a database update that isn’t installed here yet.':error.message);return data as string
}
export async function setTicketCategory(ticketId:string,category:TicketCategory,saleEndsAt:string|null) {
 const {error}=await supabase.rpc('set_ticket_type_category',{p_ticket_id:ticketId,p_category:category,p_sale_ends_at:saleEndsAt});if(error)throw new Error(error.message)
}
