import express from 'express'
import cors from 'cors'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotifyRouter, type SendPush } from './routes/notify'

export function createApp(client: SupabaseClient | null, sendPush: SendPush) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors())
  app.use(express.json({ limit: '16kb' }))
  app.get('/health', (_req, res) => res.json({ status: 'ok', message: 'Thabaat backend is running', notificationsConfigured: Boolean(client) }))
  app.use('/notify', createNotifyRouter(client, sendPush))
  return app
}
