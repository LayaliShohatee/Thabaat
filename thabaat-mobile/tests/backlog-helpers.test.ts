import { expect,it } from 'vitest'
import { filterAttendees,matchesAge,matchesGender } from '../lib/attendee-filters'
import { categoryLabel,ticketOnSale } from '../lib/ticket-categories'
import { eventImagePath,validateEventImage,validateEventImageHeader } from '../lib/event-image'

it('filters attendees by gender and age group, treating unshared values separately',()=>{
 const list=[{gender:'female',age:16},{gender:'male',age:35},{gender:null,age:null},{gender:'prefer_not_to_say',age:52}]
 expect(filterAttendees(list,'female','all')).toHaveLength(1)
 expect(filterAttendees(list,'unspecified','all')).toHaveLength(2)
 expect(filterAttendees(list,'all','30-49')).toEqual([{gender:'male',age:35}])
 expect(matchesAge({age:null},'unknown')).toBe(true);expect(matchesAge({age:17},'under18')).toBe(true);expect(matchesAge({age:50},'50plus')).toBe(true)
 expect(matchesGender({gender:'male'},'female')).toBe(false)
})

it('labels ticket categories and closes sales after the cutoff',()=>{
 expect(categoryLabel('early_bird')).toBe('Early bird');expect(categoryLabel(null)).toBe('General');expect(categoryLabel('unknown')).toBe('General')
 const now=Date.parse('2026-10-12T12:00:00Z')
 expect(ticketOnSale({sale_ends_at:null},now)).toBe(true)
 expect(ticketOnSale({sale_ends_at:'2026-10-12T11:59:00Z'},now)).toBe(false)
 expect(ticketOnSale({sale_ends_at:'2026-10-13T00:00:00Z'},now)).toBe(true)
})

it('accepts only real JPEG/PNG/WebP flyers up to 5 MB in the uploader folder',()=>{
 expect(validateEventImage({uri:'x',mimeType:'image/png',size:2000})).toEqual({mime:'image/png',extension:'png'})
 expect(()=>validateEventImage({uri:'x',mimeType:'image/gif',size:2000})).toThrow('JPEG, PNG or WebP')
 expect(()=>validateEventImage({uri:'x',mimeType:'image/jpeg',size:6*1024*1024})).toThrow('5 MB')
 expect(()=>validateEventImageHeader(new Uint8Array([0xff,0xd8,0xff,0xe0]),'image/jpeg')).not.toThrow()
 expect(()=>validateEventImageHeader(new Uint8Array([0x00,0x00,0x00,0x00]),'image/png')).toThrow('not a valid image')
 expect(eventImagePath('00000000-0000-0000-0000-000000000001','jpg','a'.repeat(32))).toBe('00000000-0000-0000-0000-000000000001/'+'a'.repeat(32)+'.jpg')
 expect(()=>eventImagePath('../etc','jpg','a'.repeat(32))).toThrow('Invalid')
})
