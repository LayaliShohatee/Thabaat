const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL // make sure to add http://localhost:3000 to backend .env file

export async function sendRegistrationConfirmation(
  userId: string,
  eventId: string
) {
  try {
    const response = await fetch(`${BACKEND_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventId })
    })

    if (!response.ok) {
      console.error('Failed to send notification')
    }
  } catch (error) {
    console.error('Notification service error:', error)
  }
}