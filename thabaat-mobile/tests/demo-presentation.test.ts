import {expect,it} from 'vitest'
import {demoEventId,demoScannerEventId,isDemoEvent,presentDemoEvent} from '../lib/demo-mode'

it('presents the selected welcome event without changing its identity or date',()=>{
 const original={id:demoEventId,title:'[STAGING] iPhone registration test',location:'Staging only',description:'Synthetic fixture',event_date:'2026-10-28T15:28:30Z'}
 const visible=presentDemoEvent(original)
 expect(visible.title).toBe('Community Welcome Evening')
 expect(visible.location).toBe('Community Center')
 expect(visible.id).toBe(original.id)
 expect(visible.event_date).toBe(original.event_date)
 expect(original.title).toBe('[STAGING] iPhone registration test')
})
it('keeps unrelated events out of the demo selection and leaves their copy intact',()=>{
 const real={id:'unrelated',title:'Existing community event',location:'Existing venue'}
 expect(isDemoEvent(real)).toBe(false)
 expect(presentDemoEvent(real)).toBe(real)
})
it('uses the same welcome title for the isolated local QA fixture',()=>{
 const local={id:'local-only',title:'Local fixture community event',location:'Local test venue'}
 expect(isDemoEvent(local)).toBe(true)
 expect(presentDemoEvent(local).title).toBe('Community Welcome Evening')
})
it('identifies the separate volunteer scanner event without changing its ID',()=>{
 const event={id:demoScannerEventId,title:'[STAGING] Scanner acceptance Oct 4',location:'Synthetic venue'}
 expect(isDemoEvent(event)).toBe(true)
 expect(presentDemoEvent(event)).toMatchObject({id:demoScannerEventId,title:'Volunteer Check-in',location:'Community Center'})
})
