import 'dotenv/config'
import { Expo } from 'expo-server-sdk'
import { createApp } from './app'
import { supabaseAdmin } from './lib/supabaseAdmin'
import { charityStackConfig } from './lib/charitystack'

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })
const app = createApp(supabaseAdmin, messages => expo.sendPushNotificationsAsync(messages), { config: charityStackConfig() })
const port = Number(process.env.PORT || 3000)
app.listen(port, () => console.log(`Thabaat backend running on port ${port}`))
export default app
