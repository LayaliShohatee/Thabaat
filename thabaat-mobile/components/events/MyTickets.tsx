import { useFocusResource } from '@/hooks/useFocusResource'
import { brand, fonts } from '@/constants/brand'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { cancelFreeRegistration, getUserRegistrations } from '@/services/registrationService'
import { useAuth } from '@/hooks/useAuth'
import { requestRefund } from '@/services/refundDiscountService'
import { Registration } from '@/types'
import { sortTickets } from '@/lib/ticket-order'

// The caller's bookings, shown under Events → My tickets.
export default function MyTickets() {
  const { user } = useAuth()
  const [now] = useState(Date.now)
  const [busy, setBusy] = useState<string | null>(null)
  const actionInFlight = useRef(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const load = useCallback(() => user ? getUserRegistrations(user.id) : Promise.resolve([]), [user])
  const { data: registrations, loading, error, reload } = useFocusResource<Registration[]>(load, [], 5000)

  const cancel = async (item: Registration) => {
    if (actionInFlight.current) return
    actionInFlight.current = true; setBusy(item.id); setNotice('')
    try { await cancelFreeRegistration(item.id); setCancelId(null); setNotice('Registration cancelled. Your ticket remains in history.'); await reload() }
    catch (err) { setNotice(err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : 'Cancellation failed. Please retry.') }
    finally { actionInFlight.current = false; setBusy(null) }
  }

  // Paid tickets are cancelled through a refund request the event team approves before the refund deadline.
  const refund = async (item: Registration) => {
    if (actionInFlight.current) return
    actionInFlight.current = true; setBusy(item.id); setNotice('')
    try { await requestRefund(item.id, ''); setNotice('Refund requested. The event team will review it; your ticket stays active until approved.') }
    catch (err) { setNotice(err instanceof Error ? err.message : 'Refund request failed. Please retry.') }
    finally { actionInFlight.current = false; setBusy(null) }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brand.primary} />
      </View>
    )
  }

  if (error) return <View style={styles.centered}><Text style={styles.emptyText} accessibilityRole="alert">{error}</Text><PressableScale accessibilityRole="button" style={styles.browseButton} onPress={reload}><Text>Try Again</Text></PressableScale></View>

  return (
    <FlatList
      data={sortTickets(registrations, now)}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>{Boolean(notice) && <Text accessibilityRole="alert" style={styles.emptyText}>{notice}</Text>}</View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>You haven’t registered for any events yet</Text>
          <PressableScale
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)/events')}
          >
            <Text style={styles.browseButtonText}>Browse Events</Text>
          </PressableScale>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}><PressableScale
          onPress={() => router.push(item.status === 'confirmed' ? `/ticket/${item.id}` : `/event/${item.event_id}`)}
        >
          <View style={styles.cardContent}>
            <Text style={styles.eventTitle}>
              {item.event?.title ?? 'Event'}
            </Text>
            {item.event?.event_date && (
              <Text style={styles.eventDate}>
                {new Date(item.event.event_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </Text>
            )}
            <Text style={styles.ticketType}>
              {item.ticket_type?.name ?? 'Ticket'}
            </Text>
            <View style={[
              styles.statusBadge,
              item.status === 'confirmed' && styles.statusConfirmed
            ]}>
              <Text style={styles.statusText}>{item.status ?? 'registered'}</Text>
            </View>
            {item.status === 'confirmed' && item.checked_in_at !== undefined && <Text accessibilityLiveRegion="polite" style={styles.actionText}>{item.checked_in_at ? `Checked in · ${new Date(item.checked_in_at).toLocaleString()}` : 'Not checked in'}</Text>}
          </View>
        </PressableScale>
          {item.status === 'confirmed' && <PressableScale accessibilityRole="button" style={[styles.actionButton,styles.primaryAction]} onPress={() => router.push(`/ticket/${item.id}`)}><Text style={styles.primaryActionText}>Open ticket</Text></PressableScale>}
          {item.status === 'confirmed' && !item.checked_in_at && Number(item.ticket_type?.price) === 0 && item.event && new Date(item.event.event_date).getTime() > now && <PressableScale accessibilityRole="button" disabled={busy !== null} style={styles.actionButton} onPress={() => setCancelId(item.id)}><Text style={styles.actionText}>{busy === item.id ? 'Cancelling…' : 'Cancel free registration'}</Text></PressableScale>}
          {cancelId === item.id && item.status === 'confirmed' && <View style={styles.cardContent}>
            <Text style={styles.actionText}>Cancel this free registration? Your place will be released. Re-registering depends on remaining availability.</Text>
            <PressableScale accessibilityRole="button" disabled={busy !== null} style={styles.actionButton} onPress={() => setCancelId(null)}><Text style={styles.actionText}>Keep registration</Text></PressableScale>
            <PressableScale accessibilityRole="button" disabled={busy !== null} style={styles.actionButton} onPress={() => void cancel(item)}><Text style={styles.actionText}>{busy === item.id ? 'Cancelling…' : 'Confirm cancellation'}</Text></PressableScale>
          </View>}
          {item.status === 'confirmed' && !item.checked_in_at && Number(item.ticket_type?.price) > 0 && item.event && new Date(item.event.event_date).getTime() > now && <PressableScale accessibilityRole="button" disabled={busy !== null} style={styles.actionButton} onPress={() => void refund(item)}><Text style={styles.actionText}>{busy === item.id ? 'Sending…' : 'Cancel and request refund'}</Text></PressableScale>}
          {item.status === 'cancelled' && item.event && new Date(item.event.event_date).getTime() > now && <PressableScale accessibilityRole="button" style={styles.actionButton} onPress={() => router.push(`/registration/${item.event_id}`)}><Text style={styles.actionText}>Register again</Text></PressableScale>}
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  actionButton: { padding: 16, borderTopWidth: 1, borderColor: brand.line },
  primaryAction: { backgroundColor: brand.primary, borderTopWidth: 0 },
  primaryActionText: { color: '#FFFFFF', fontWeight: '700' },
  actionText: { color: brand.ink, fontWeight: '600' },
  list: {
    backgroundColor: brand.page,
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 40
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: brand.page
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60
  },
  emptyText: {
    color: brand.inkMuted,
    fontSize: 16,
    marginBottom: 20
  },
  browseButton: {
    backgroundColor: brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold'
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: brand.card,
    borderRadius: 12,
    overflow: 'hidden'
  },
  cardContent: {
    padding: 16
  },
  eventTitle: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: brand.ink,
    marginBottom: 4
  },
  eventDate: {
    fontSize: 14,
    color: brand.inkMuted,
    marginBottom: 4
  },
  ticketType: {
    fontSize: 13,
    color: brand.inkMuted,
    marginBottom: 8
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: brand.primarySoft
  },
  statusConfirmed: {
    backgroundColor: brand.primarySoft
  },
  statusText: {
    color: brand.ink,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize'
  }
})
