import { Router, Request, Response } from 'express'

const router = Router()

// POST /notify
// Jenna implements this — sends Expo push notification to a user
router.post('/', async (req: Request, res: Response) => {
  const { userId, eventId } = req.body

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId and eventId are required' })
  }

  // TODO: Jenna implements notification dispatch here
  // 1. Look up user's expo_push_token from Supabase using userId
  // 2. Look up event title using eventId
  // 3. POST to https://exp.host/push/send with token and message

  res.json({ message: 'Notify endpoint placeholder — Jenna implements this' })
})

export default router