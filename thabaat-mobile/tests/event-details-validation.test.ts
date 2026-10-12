import { expect,it } from 'vitest'
import { emptyEventDetails,validateEventDetails } from '../lib/event-details'
it('keeps optional timezone unset and parses an explicit end offset',()=>{
 const result=validateEventDetails({...emptyEventDetails,end_at:'2026-10-20T20:00:00-04:00'},'2026-10-20T22:00:00Z')
 expect(result.timezone).toBe('');expect(result.end_at).toBe('2026-10-21T00:00:00.000Z')
})
it('rejects ambiguous policy fields, unsafe image URLs and invalid timing',()=>{
 const start='2026-10-20T22:00:00Z'
 expect(()=>validateEventDetails({...emptyEventDetails,age_min:'21',age_max:'18'},start)).toThrow('Maximum age')
 expect(()=>validateEventDetails({...emptyEventDetails,image_url:'http://example.invalid'},start)).toThrow('HTTPS')
 expect(()=>validateEventDetails({...emptyEventDetails,timezone:'Invalid/Zone'},start)).toThrow('timezone')
 expect(()=>validateEventDetails({...emptyEventDetails,end_at:start},start)).toThrow('End time')
})
