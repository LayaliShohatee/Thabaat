export const notificationCategories = ['men', 'women', 'young_professionals', 'volunteer', 'conferences'] as const
export const reminderCadences = ['week', 'day', 'morning', 'starting'] as const
export type NotificationPreferences = { push_enabled: boolean; confirmations: boolean; membership_alerts: boolean; video_alerts: boolean; reminders: string[]; categories: string[] }
export const defaultNotificationPreferences = (): NotificationPreferences => ({ push_enabled: false, confirmations: false, membership_alerts: false, video_alerts: false, reminders: [], categories: [] })
export function normalizeNotificationPreferences(value: Partial<NotificationPreferences> | null): NotificationPreferences {
 const defaults = defaultNotificationPreferences()
 if (!value) return defaults
 return { push_enabled: value.push_enabled === true, confirmations: value.confirmations === true, membership_alerts: value.membership_alerts === true, video_alerts: value.video_alerts === true,
 reminders: reminderCadences.filter(item => Array.isArray(value.reminders) && value.reminders.includes(item)), categories: notificationCategories.filter(item => Array.isArray(value.categories) && value.categories.includes(item)) }
}
export function togglePreference(items: string[], item: string): string[] { return items.includes(item) ? items.filter(value => value !== item) : [...items, item] }
