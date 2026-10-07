import { supabase } from '@/lib/supabase'
import { normalizeNotificationPreferences, type NotificationPreferences } from '@/lib/notification-preferences'
export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
 const { data, error } = await supabase.from('notification_preferences').select('push_enabled,confirmations,membership_alerts,video_alerts,reminders,categories').eq('user_id', userId).maybeSingle()
 if (error) throw new Error('Notification settings are unavailable. Retry after the team enables the notification database setup.')
 return normalizeNotificationPreferences(data)
}
export async function saveNotificationPreferences(userId: string, value: NotificationPreferences): Promise<NotificationPreferences> {
 const clean = normalizeNotificationPreferences(value)
 const { data, error } = await supabase.from('notification_preferences').upsert({ user_id: userId, ...clean }, { onConflict: 'user_id' }).select('push_enabled,confirmations,membership_alerts,video_alerts,reminders,categories').single()
 if (error) throw new Error('Settings were not saved. Check your connection and retry.')
 return normalizeNotificationPreferences(data)
}
