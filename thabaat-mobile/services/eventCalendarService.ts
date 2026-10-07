import { Platform } from 'react-native'
import * as Calendar from 'expo-calendar'
import { calendarDetails, calendarResultMessage, type CalendarEvent } from '@/lib/event-calendar'

export async function openDeviceCalendar(event: CalendarEvent) {
  const details = calendarDetails(event)
  // The separate .web service keeps browser builds free of the native module.
  const permission = await Calendar.requestCalendarPermissions(Platform.OS === 'ios')
  if (!permission.granted) throw new Error('Calendar permission was not granted. You can use Google Calendar or Outlook instead, or enable access in Settings.')
  // iOS write-only access exposes a virtual default calendar. Do not inspect
  // its modification flags or enumerate the user's real calendars.
  const writable = Platform.OS === 'ios'
    ? Calendar.getDefaultCalendarSync()
    : (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).find(calendar => calendar.allowsModifications)
  if (!writable) throw new Error('No writable calendar is available. Add a calendar account on your device, or use Google Calendar or Outlook.')
  const result = await writable.addEventWithForm({ ...details, startNewActivityTask: false })
  return calendarResultMessage(result.action)
}
