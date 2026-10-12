import 'dotenv/config'
import { Expo } from 'expo-server-sdk'
import { createApp } from './app'
import { supabaseAdmin } from './lib/supabaseAdmin'
import { charityStackConfig } from './lib/charitystack'
import { startNotificationScheduler } from './notifications/scheduler'

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })
const sendPush = (messages: Parameters<typeof expo.sendPushNotificationsAsync>[0]) => expo.sendPushNotificationsAsync(messages)
const app = createApp(supabaseAdmin, sendPush, { config: charityStackConfig() })
// Scheduled delivery stays off until production push setup is approved.
if (process.env.NOTIFICATIONS_ENABLED === 'true') startNotificationScheduler(supabaseAdmin, sendPush)
const port = Number(process.env.PORT || 3000)
app.listen(port, () => console.log(`Thabaat backend running on port ${port}`))
export default app
