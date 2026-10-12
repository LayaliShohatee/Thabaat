import {expect,it} from 'vitest'
import {defaultNotificationPreferences,normalizeNotificationPreferences,togglePreference} from '../lib/notification-preferences'
it('defaults to explicit opt-in rather than treating device permission as consent',()=>{
 expect(defaultNotificationPreferences()).toEqual({push_enabled:false,confirmations:false,membership_alerts:false,video_alerts:false,reminders:[],categories:[]})
})
it('drops unknown categories/cadences and deduplicates saved settings',()=>{
 expect(normalizeNotificationPreferences({push_enabled:true,reminders:['day','day','unknown'],categories:['women','unknown']})).toMatchObject({push_enabled:true,reminders:['day'],categories:['women'],confirmations:false})
})
it('repeated toggle restores choices and disabled master switch preserves subscriptions',()=>{
 const preferences={...defaultNotificationPreferences(),categories:['women'],reminders:['day']}
 expect(togglePreference(togglePreference(preferences.categories,'volunteer'),'volunteer')).toEqual(['women'])
 expect(normalizeNotificationPreferences(preferences).categories).toEqual(['women'])
})
