import type { Permissions } from '@/services/managementService'

// attendee: Home, Events, Account. volunteer: + Team. admin (and organizers who manage events): + Team and Admin.
export type AppRole = 'attendee' | 'volunteer' | 'admin'

export function appRole(permissions: Pick<Permissions, 'staff_role' | 'can_manage_events'> | null): AppRole {
  if (!permissions) return 'attendee'
  if (permissions.staff_role === 'admin' || permissions.can_manage_events) return 'admin'
  if (permissions.staff_role === 'volunteer') return 'volunteer'
  return 'attendee'
}

export const showsTeamTab = (role: AppRole) => role !== 'attendee'
export const showsAdminTab = (role: AppRole) => role === 'admin'
