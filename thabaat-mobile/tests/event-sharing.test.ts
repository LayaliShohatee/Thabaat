import {expect,it} from 'vitest'
import {eventIdFromPath,eventReturnPath,eventShareLink,eventShareMessage} from '../lib/event-sharing'
import {authRedirect} from '../lib/auth-routing'
const id='10000000-0000-0000-0000-000000000001'
it('shares only event route without account, ticket, payment or member-content fields',()=>{
 const link=eventShareLink(id)
 expect(link).toEqual({url:`thabaat://event/${id}`,webFallback:false})
 expect(eventShareMessage(link.url)).toBe(`View this Thabaat event (sign-in required): thabaat://event/${id}`)
})
it('requires explicit valid HTTPS origin for browser fallback without inventing a host',()=>{
 expect(eventShareLink(id,'https://approved.example.invalid/')).toEqual({url:`https://approved.example.invalid/event/${id}`,webFallback:true})
 for(const origin of ['http://example.invalid','https://username:password@example.invalid','https://example.invalid/path','https://example.invalid/?redirect=evil','https://localhost','javascript:alert(1)'])expect(()=>eventShareLink(id,origin)).toThrow()
 expect(()=>eventShareLink('../payments')).toThrow()
})
it('return navigation permits only an exact event UUID, never external or privileged routes',()=>{
 expect(eventIdFromPath(`/event/${id}`)).toBe(id)
 expect(eventReturnPath(id)).toBe(`/event/${id}`)
 for(const value of [`/event/${id}/access`,'https://evil.invalid','../permissions',`//event/${id}`,['valid','evil'],`${id}?token=secret`])expect(eventReturnPath(value)).toBeNull()
 expect(eventIdFromPath(`/event/access/${id}`)).toBeNull()
 expect(authRedirect(true,['auth','login'],id)).toBe(`/event/${id}`)
 expect(authRedirect(true,['auth','login'],'https://evil.invalid')).toBe('/(tabs)')
 expect(authRedirect(false,['event','[id]'],id)).toBe('/auth/login')
})
