// Presentation-only switch. Authorization and server-side checks remain authoritative.
export const isDemoMode = false // Preserve the complete working navigation and Profile capabilities.
export const demoEventId = '31000000-0000-4000-8000-000000000002'
export const demoScannerEventId = '6b574d61-0e44-4d37-805b-f2f2fd2590e9'
export function presentDemoEvent<T extends {id:string;title:string;description?:string|null;location?:string}>(event:T):T {
 if(event.id===demoEventId || event.title==='Local fixture community event')return {...event,title:'Community Welcome Evening',description:'Meet the Thabaat community, learn about upcoming activities, and connect with other members.',location:'Community Center',speaker_name:null}
 if(event.id===demoScannerEventId)return {...event,title:'Volunteer Check-in',description:'Welcome attendees and validate their event tickets.',location:'Community Center'}
 return event
}
export function isDemoEvent(event:{id:string;title:string}) {return event.id===demoEventId||event.id===demoScannerEventId||event.title==='Local fixture community event'}
