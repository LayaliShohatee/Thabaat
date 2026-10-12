import { Router } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk'
import { rateLimit } from 'express-rate-limit'
import { verifyAuth } from '../middleware/auth'

export type SendPush = (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createNotifyRouter(client: SupabaseClient | null, sendPush: SendPush) {
  const router = Router()
  router.use(rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }))
  router.use(verifyAuth(client))
  router.post('/', async (req, res) => {
    const userId = res.locals.userId as string
    const { eventId, userId: requestedUser } = req.body ?? {}
    if (requestedUser && requestedUser !== userId) return res.status(403).json({ error: 'Cannot notify another user' })
    if (typeof eventId !== 'string' || !uuid.test(eventId)) return res.status(400).json({ error: 'A valid eventId is required' })
    let jobId: string | null = null
    try {
      const { data: registration, error: registrationError } = await client!.from('registrations').select('id,status').eq('user_id', userId).eq('event_id', eventId).maybeSingle()
      if (registrationError) return res.status(503).json({ error: 'Unable to verify registration' })
      if (!registration || registration.status !== 'confirmed') return res.status(403).json({ error: 'Register for this event first' })
      const { data: preferences, error: preferencesError } = await client!.from('notification_preferences').select('push_enabled,confirmations').eq('user_id', userId).maybeSingle()
      if (preferencesError) return res.status(503).json({ error: 'Unable to verify notification preferences' })
      if (!preferences?.push_enabled || !preferences.confirmations) return res.json({ success: false, status: 'suppressed' })
      const { data: profile, error: profileError } = await client!.from('profiles').select('expo_push_token').eq('id', userId).maybeSingle()
      if (profileError) return res.status(503).json({ error: 'Notification database setup is incomplete' })
      if (!profile?.expo_push_token || !Expo.isExpoPushToken(profile.expo_push_token)) return res.status(409).json({ error: 'Enable push notifications on your device first' })
      const { data: event, error: eventError } = await client!.from('events').select('title,archived').eq('id', eventId).maybeSingle()
      if (eventError) return res.status(503).json({ error: 'Unable to load event' })
      if (!event || event.archived) return res.status(404).json({ error: 'Event not found' })
      const { data: claim, error: claimError } = await client!.rpc('claim_registration_confirmation', { p_user_id: userId, p_event_id: eventId })
      if (claimError) return res.status(503).json({ error: 'Unable to claim notification delivery' })
      if (claim?.status !== 'claimed') return res.json({ success: claim?.status === 'accepted', status: claim?.status ?? 'suppressed' })
      jobId = claim.id
      const tickets = await sendPush([{ to: profile.expo_push_token, sound: 'default', title: 'Registration Confirmed', body: `You are registered for ${event.title}`, data: { eventId } }])
      if (tickets.length !== 1 || tickets[0].status !== 'ok') {
        await client!.rpc('complete_notification_job', { p_id: jobId, p_status: 'failed' })
        return res.status(502).json({ error: 'Push service did not accept the notification' })
      }
      const { error: completionError } = await client!.rpc('complete_notification_job', { p_id: jobId, p_status: 'accepted' })
      if (completionError) return res.status(503).json({ error: 'Push accepted; recording is incomplete. Do not retry automatically.' })
      // A push ticket means accepted by Expo, not delivered to the device.
      return res.json({ success: true, status: 'accepted' })
    } catch {
      if (jobId) await Promise.resolve(client!.rpc('complete_notification_job', { p_id: jobId, p_status: 'uncertain' })).catch(() => undefined)
      return res.status(502).json({ error: 'Notification service is unavailable' })
    }
  })
  return router
}
