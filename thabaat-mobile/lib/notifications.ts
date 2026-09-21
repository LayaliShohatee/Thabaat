import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export async function registerForPushNotifications(userId: string): Promise<string> {
  if (Platform.OS === 'web') return 'Push notifications require the mobile app on a physical device.'
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'Push notifications require a development build, rather than Expo Go.'
  if (!Device.isDevice) return 'Use a physical device to enable push notifications.'
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return 'Notifications are not configured for this build yet.'
  const Notifications = await import('expo-notifications')
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: Notifications.AndroidImportance.HIGH })
  }
  const current = await Notifications.getPermissionsAsync()
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync()
  if (!permission.granted) return 'Notifications are disabled. You can enable them in your device settings.'
  const token = await Notifications.getExpoPushTokenAsync({ projectId })
  const { error } = await supabase.from('profiles').update({ expo_push_token: token.data }).eq('id', userId).select('id').single()
  if (error) throw new Error('Unable to save notification preferences. The team needs to finish the notification database setup.')
  return 'Notifications enabled.'
}
