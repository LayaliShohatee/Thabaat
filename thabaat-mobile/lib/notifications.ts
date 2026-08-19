import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase'

export async function registerForPushNotifications(userId: string) {
  const { status } = await Notifications.requestPermissionsAsync()
  
  if (status !== 'granted') {
    console.warn('Notification permission not granted')
    return
  }

  const token = await Notifications.getExpoPushTokenAsync()
  
  await supabase
    .from('profiles')
    .update({ expo_push_token: token.data })
    .eq('id', userId)
}