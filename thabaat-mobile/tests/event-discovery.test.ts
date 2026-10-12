import { expect, it } from 'vitest'
import { filterEvents } from '../lib/event-discovery'
import type { Event } from '../types'
const now = new Date('2026-10-05T12:00:00Z')
const event = (id: string, days: number, location = 'Detroit'): Event => ({id,title: `Event ${id}`,description:'Community gathering',speaker_name:'Amina',location,event_date:new Date(+now + days * 86400000).toISOString(),image_url:null})
const events = [event('late',20),event('soon',1),event('week-boundary',7),event('past',-1),{...event('invalid',1),event_date:'invalid'},event('other',2,'Dearborn')]
it('orders upcoming events and excludes expired or invalid dates', () => expect(filterEvents(events,{search:'',window:'all',location:''},now).map(e=>e.id)).toEqual(['soon','other','week-boundary','late']))
it('combines search, exact venue and rolling date range', () => expect(filterEvents(events,{search:' AMINA ',window:'week',location:'Detroit'},now).map(e=>e.id)).toEqual(['soon']))
it('searches description and returns a recoverable empty result', () => {
 expect(filterEvents(events,{search:'community',window:'month',location:''},now)).toHaveLength(4)
 expect(filterEvents(events,{search:'missing',window:'all',location:''},now)).toEqual([])
 expect(filterEvents(events,{search:'',window:'all',location:''},now)).toHaveLength(4)
})
it('does not mutate the loaded feed', () => { const before = [...events]; filterEvents(events,{search:'',window:'all',location:''},now); expect(events).toEqual(before) })
