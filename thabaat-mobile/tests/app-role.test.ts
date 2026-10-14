import { expect, it } from 'vitest'
import { appRole, showsAdminTab, showsTeamTab } from '../lib/app-role'

it('attendees see only Home, Events and Account', () => {
 for (const permissions of [null, { staff_role: null, can_manage_events: false }]) {
  const role = appRole(permissions)
  expect(role).toBe('attendee')
  expect(showsTeamTab(role)).toBe(false)
  expect(showsAdminTab(role)).toBe(false)
 }
})

it('volunteers add Team; admins and organizers add Team and Admin', () => {
 const volunteer = appRole({ staff_role: 'volunteer', can_manage_events: false })
 expect([showsTeamTab(volunteer), showsAdminTab(volunteer)]).toEqual([true, false])
 for (const staff_role of ['admin', 'organizer'] as const) {
  const role = appRole({ staff_role, can_manage_events: true })
  expect([showsTeamTab(role), showsAdminTab(role)]).toEqual([true, true])
 }
})
