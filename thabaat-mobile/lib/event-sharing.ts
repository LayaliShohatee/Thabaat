const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validEventId(value:unknown):value is string{return typeof value==='string'&&uuid.test(value)}
export function eventIdFromPath(path:string):string|null{
 const match=/^\/event\/([^/?#]+)\/?$/.exec(path)
 return match&&validEventId(match[1])?match[1]:null
}
export function eventReturnPath(value:unknown):`/event/${string}`|null{return validEventId(value)?`/event/${value}`:null}
export function eventShareLink(eventId:string,origin?:string):{url:string;webFallback:boolean}{
 if(!validEventId(eventId))throw new Error('A valid event is required to create a share link.')
 if(origin){
  let url:URL
  try{url=new URL(origin)}catch{throw new Error('The event sharing website is not configured correctly.')}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(url.pathname!=='/'&&url.pathname!=='')||['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))throw new Error('Event sharing requires an approved HTTPS website origin.')
  return{url:`${url.origin}/event/${eventId}`,webFallback:true}
 }
 return{url:`thabaat://event/${eventId}`,webFallback:false}
}
// Share only an authenticated route, never user records, ticket credentials or member-only descriptions.
export const eventShareMessage=(url:string)=>`View this Thabaat event (sign-in required): ${url}`
