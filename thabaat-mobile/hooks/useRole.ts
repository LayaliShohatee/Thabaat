import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getPermissions, type Permissions } from '@/services/managementService'
import { appRole, type AppRole } from '@/lib/app-role'

// Decides which tabs to show. It only hides navigation; the server still checks every staff action.
export function useRole(): { role: AppRole; permissions: Permissions | null } {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  useEffect(() => {
    let active = true
    setPermissions(null)
    if (user) getPermissions().then(next => { if (active) setPermissions(next) }).catch(() => {})
    return () => { active = false }
  }, [user])
  return { role: appRole(permissions), permissions }
}
