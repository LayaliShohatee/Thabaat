export type ScanAttempt = {status:'accepted';token:string} | {status:'invalid'} | {status:'ignored'}
// Synchronous gate closes before awaiting the network, including same-frame camera callbacks.
export function createTicketScanGate() {
 let busy=false,paused=false,retryAfter=0
 return {
  accept(value:string,now=Date.now()):ScanAttempt {
   if(busy||paused||now<retryAfter)return {status:'ignored'}
   const token=value.trim()
   if(!/^[0-9a-f]{64}$/.test(token)){retryAfter=now+1500;return {status:'invalid'}}
   busy=true
   return {status:'accepted',token}
  },
  complete(success:boolean,now=Date.now()) {busy=false;paused=success;retryAfter=success?0:now+1500},
  reset(){if(busy)return false;paused=false;retryAfter=0;return true},
 }
}
