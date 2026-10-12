import { useCallback } from 'react'
import { Text, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getEventById } from '@/services/eventService'
import CalendarActions from '@/components/events/CalendarActions'
import { TicketWalletAction } from '@/components/TicketWalletAction'
import { ManagementButton } from '@/components/ManagementUI'
import { isDemoMode } from '@/lib/demo-mode'

export default function RegisteredEventActions({ eventId, registrationId }: { eventId: string; registrationId: string }) {
  const load = useCallback(() => getEventById(eventId), [eventId])
  const { data: event, loading, error, reload } = useFocusResource(load, null)
  return <View style={{ width: '100%', gap: 12 }}>
    {event && !error && <CalendarActions event={event} />}
    {loading && <Text style={{ color: '#425550', backgroundColor: '#fff', padding: 18 }}>Loading calendar details…</Text>}
    {!!error && <><Text accessibilityRole="alert" style={{ color: '#425550', backgroundColor: '#fff', padding: 18 }}>Calendar details could not load. Your registration remains saved.</Text><ManagementButton label="Retry calendar details" onPress={() => void reload()} /></>}
    {!isDemoMode && <TicketWalletAction registrationId={registrationId} />}
  </View>
}
