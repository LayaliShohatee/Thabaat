import type { Request, Response, NextFunction } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'

export function verifyAuth(client: SupabaseClient | null) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')
    if (!bearer) return res.status(401).json({ error: 'Authentication required' })
    if (!client) return res.status(503).json({ error: 'Notification service is not configured' })
    try {
      const { data, error } = await client.auth.getUser(bearer[1])
      if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' })
      res.locals.userId = data.user.id
      next()
    } catch {
      return res.status(503).json({ error: 'Unable to verify session' })
    }
  }
}
