import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const { userId, eventId } = req.body

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId and eventId are required' })
  }

  try {
    // Step 1 — get the user's Expo push token from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('expo_push_token, full_name')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    if (!profile.expo_push_token) {
      return res.status(400).json({ error: 'User has no push token registered' })
    }

    // Step 2 — get the event title
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('title, date')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    // Step 3 — send push notification via Expo's push API
    const message = {
      to: profile.expo_push_token,
      sound: 'default',
      title: 'Registration Confirmed',
      body: `You're registered for ${event.title}`,
      data: { eventId }
    }

    const expoPushResponse = await fetch('https://exp.host/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify(message)
    })

    const expoPushResult = await expoPushResponse.json()

    return res.status(200).json({
      success: true,
      result: expoPushResult
    })

  } catch (error) {
    console.error('Notification error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router