import type { StaffReport } from '../services/staffService'
// Excel interprets values beginning with these characters as executable formulas.
export function csvCell(value:unknown):string {
 let text=String(value??'')
 if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r]/.test(text)) text="'"+text
 return '"'+text.replace(/"/g,'""')+'"'
}
export function eventRegistrationCsv(report:StaffReport):string {
 return [['Registration ID','Name','Ticket','Status','Registered at'],...report.registrations.map(r=>[r.registration_id,r.full_name,r.ticket_name,r.status,r.registered_at])].map(row=>row.map(csvCell).join(',')).join('\r\n')
}
export function volunteerHoursCsv(report:StaffReport):string {
 return [['Name','Duty','Shift start','Shift end','Active','Reviewed hours'],...report.volunteers.map(v=>[v.full_name,v.duty,v.shift_start,v.shift_end,v.active?'Yes':'No',v.reviewed_hours])].map(row=>row.map(csvCell).join(',')).join('\r\n')
}
