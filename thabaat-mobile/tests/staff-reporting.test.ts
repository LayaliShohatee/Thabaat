import { expect,it } from 'vitest'
import { csvCell,eventRegistrationCsv,volunteerHoursCsv } from '../lib/staff-reporting'
import type { StaffReport } from '../services/staffService'
it('escapes CSV delimiters, embedded quotes, newlines and spreadsheet formula injection',()=>{
 expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"')
 for(const value of ['=HYPERLINK("x")',' +SUM(1)','-1+2','@cmd','\ttext','\rtext'])expect(csvCell(value).startsWith('"\'')).toBe(true)
 expect(csvCell(null)).toBe('""')
})
it('exports only approved report fields and preserves reviewed hours',()=>{
 const report={event:{title:'x',capacity:2,event_date:'x'},registrations:[{registration_id:'1',full_name:'=cmd',ticket_name:'General',status:'confirmed',registered_at:'2026-10-01'}],volunteers:[{full_name:'Helper',duty:'Welcome',shift_start:'a',shift_end:'b',active:false,reviewed_hours:2}]} as StaffReport
 expect(eventRegistrationCsv(report)).toContain("\"'=cmd\"")
 expect(eventRegistrationCsv(report)).not.toContain('email')
 expect(volunteerHoursCsv(report)).toContain('"No","2"')
})
