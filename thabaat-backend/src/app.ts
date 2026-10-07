import express from 'express'
import { createMediaRouter } from './routes/media'
import { createWalletRouter } from './routes/wallet'
import cors from 'cors'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotifyRouter, type SendPush } from './routes/notify'
import { createPaymentsRouter, createWebhookRouter, type PaymentOptions } from './routes/payments'

export function createApp(client: SupabaseClient | null, sendPush: SendPush, payments: PaymentOptions = { config: null }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors())
  app.use('/payments/charitystack/webhook', createWebhookRouter(client, payments))
  app.use(express.json({ limit: '16kb' }))
  app.get('/health', (_req, res) => res.json({ status: 'ok', message: 'Thabaat backend is running', notificationsConfigured: Boolean(client) }))
  app.use('/media', createMediaRouter(client))
  app.use('/wallet', createWalletRouter(client))
  app.use('/notify', createNotifyRouter(client, sendPush))
  app.use('/payments', createPaymentsRouter(client, payments))
  return app
}
