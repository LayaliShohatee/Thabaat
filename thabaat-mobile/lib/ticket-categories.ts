export const TICKET_CATEGORIES=['general','adult','child','vip','food','early_bird'] as const
export type TicketCategory=typeof TICKET_CATEGORIES[number]
export const ticketCategoryLabel:Record<TicketCategory,string>={general:'General',adult:'Adult',child:'Child',vip:'VIP',food:'Food',early_bird:'Early bird'}
export function categoryLabel(category?:string|null){return ticketCategoryLabel[(category||'general') as TicketCategory]??'General'}
// A ticket with a passed sales cutoff (early bird) can no longer be booked.
export function ticketOnSale(ticket:{sale_ends_at?:string|null},now=Date.now()){return !ticket.sale_ends_at||new Date(ticket.sale_ends_at).getTime()>now}
