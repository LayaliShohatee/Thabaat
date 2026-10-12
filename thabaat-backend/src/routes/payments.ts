import { Router, raw } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyAuth } from '../middleware/auth'
import { createCheckoutClient, validateProviderLink, verifyWebhook, type CharityStackConfig, type CreateCheckout } from '../lib/charitystack'

export type PaymentOptions = { config: CharityStackConfig | null; createCheckout?: CreateCheckout }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mount BEFORE express.json: signatures cover the exact bytes, including whitespace.
export function createWebhookRouter(client: SupabaseClient | null, options: PaymentOptions) {
  const router = Router()
  router.post('/', raw({ type: 'application/json', limit: '256kb', inflate: false }), async (req, res) => {
    const { config } = options
    if (!client || !config?.webhookSecret) return res.status(503).json({ error: 'Payment notifications are not configured' })
    if (!Buffer.isBuffer(req.body) || !verifyWebhook(req.body, req.get('x-webhook-timestamp') || '', req.get('x-webhook-signature') || '', config.webhookSecret)) return res.status(401).json({ error: 'Invalid webhook signature' })
    let event: unknown
    try { event = JSON.parse(req.body.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid event JSON' }) }
    if (!event || typeof event !== 'object' || Array.isArray(event) || typeof (event as any).type !== 'string' || (event as any).type.length > 100) return res.status(400).json({ error: 'Invalid event envelope' })
    try {
      // The delivery ID header is not part of the signature. Deduplicate signed BODY bytes.
      // Persist first, acknowledge second. No entitlement is granted from an email/amount match.
      const { error } = await client.from('charitystack_webhook_inbox').insert({
        payload_sha256: createHash('sha256').update(req.body).digest('hex'), mode: config.mode,
        event_type: (event as any).type, payload: event, status: 'needs_review',
      })
      if (error?.code === '23505') return res.status(200).json({ received: true, duplicate: true })
      if (error) return res.status(503).json({ error: 'Unable to save notification; retry delivery' })
      return res.status(202).json({ received: true, status: 'needs_review' })
    } catch { return res.status(503).json({ error: 'Unable to save notification; retry delivery' }) }
  })
  return router
}

export function createPaymentsRouter(client: SupabaseClient | null, options: PaymentOptions) {
  const router = Router()
  router.use(rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }))
  router.use(verifyAuth(client))
  router.post('/checkout', async (req, res) => {
    const orderId = req.body?.orderId
    if (typeof orderId !== 'string' || !uuid.test(orderId) || Object.keys(req.body).some(k => k !== 'orderId')) return res.status(400).json({ error: 'Provide only an orderId' })
    const { config } = options
    if (!client || !config) return res.status(503).json({ error: 'Server checkout is not configured yet. Do not pay again.' })
    try {
      const { data: order, error } = await client.from('paid_event_orders').select('id,user_id,ticket_type_id,event_id,form_id,amount_cents,currency,status').eq('id', orderId).eq('user_id', res.locals.userId).maybeSingle()
      if (error) throw error
      if (!order) return res.status(404).json({ error: 'Order not found' })
      if (order.status !== 'pending') return res.status(409).json({ error: 'This order is no longer pending' })
      const { data: settings, error: settingsError } = await client.from('paid_event_checkout_configs').select('form_id,enabled,provider_mode,provider_ticket_name').eq('ticket_type_id', order.ticket_type_id).maybeSingle()
      const { data: event, error: eventError } = await client.from('events').select('event_date').eq('id', order.event_id).maybeSingle()
      if (settingsError || eventError) throw settingsError || eventError
      if (!settings?.enabled || settings.form_id !== order.form_id || settings.provider_mode !== config.mode || !settings.provider_ticket_name || order.currency !== 'USD' || !Number.isSafeInteger(order.amount_cents) || order.amount_cents <= 0 || !(Date.parse(event?.event_date) > Date.now())) return res.status(409).json({ error: 'Checkout configuration is unavailable or the event has ended' })
      // The unique order key is a cross-process lock. Unknown outcomes are never auto-retried.
      const { error: claimError } = await client.from('charitystack_checkout_links').insert({ order_id: order.id, mode: config.mode, status: 'creating' })
      if (claimError) {
        if (claimError.code !== '23505') throw claimError
        const { data: existing, error: existingError } = await client.from('charitystack_checkout_links').select('status,mode,provider_link_id,checkout_url').eq('order_id', order.id).maybeSingle()
        if (existingError) throw existingError
        if (existing?.status === 'ready' && existing.mode === config.mode) return res.json({ checkoutUrl: validateProviderLink(existing.checkout_url, order.form_id, existing.provider_link_id), mode: config.mode })
        return res.status(409).json({ error: 'Checkout is being prepared or needs team review. Do not create another payment.' })
      }
      try {
        if (!res.locals.userEmail) throw new Error('Account email unavailable')
        const createCheckout = options.createCheckout || createCheckoutClient(config)
        const link = await createCheckout({ orderId, formId: order.form_id, email: res.locals.userEmail, ticketName: settings.provider_ticket_name, amountCents: order.amount_cents })
        if (link.formID !== order.form_id) throw new Error('Invalid checkout response')
        const checkoutUrl = validateProviderLink(link.checkoutUrl, order.form_id, link.linkID)
        const { error: saveError } = await client.from('charitystack_checkout_links').update({ status: 'ready', provider_link_id: link.linkID, checkout_url: checkoutUrl }).eq('order_id', order.id)
        if (saveError) throw saveError
        return res.json({ checkoutUrl, mode: config.mode })
      } catch {
        await client.from('charitystack_checkout_links').update({ status: 'needs_review' }).eq('order_id', order.id)
        return res.status(502).json({ error: 'Unable to prepare checkout safely. Ask the team to check this order before retrying.' })
      }
    } catch { return res.status(503).json({ error: 'Payment service unavailable. No access was granted; do not pay again.' }) }
  })
  return router
}
