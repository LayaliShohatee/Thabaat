import { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { brand, fonts } from '@/constants/brand'
import { EVENT_TZ, formatEventTime, wallTimeToIso, type WallTime } from '@/lib/event-time'
import { managementStyles as styles } from './ManagementUI'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MINUTES = ['00', '15', '30', '45']
const pad = (n: number) => String(n).padStart(2, '0')

// Tap-to-pick date and time in Detroit time. Plain JavaScript, so it works on phones and the web without a native rebuild.
export function DateTimeField({ label, value, onChange, optional = false }: { label: string; value: WallTime | null; onChange: (value: WallTime | null) => void; optional?: boolean }) {
 const today = new Date()
 const [open, setOpen] = useState(false)
 const [month, setMonth] = useState(() => value ? { y: Number(value.date.slice(0, 4)), m: Number(value.date.slice(5, 7)) - 1 } : { y: today.getFullYear(), m: today.getMonth() })
 const hour24 = value ? Number(value.time.slice(0, 2)) : 19
 const minute = value ? value.time.slice(3, 5) : '00'
 const pm = hour24 >= 12, hour12 = hour24 % 12 || 12
 const set = (patch: { date?: string; hour?: number; minute?: string }) => {
  const date = patch.date ?? value?.date ?? `${month.y}-${pad(month.m + 1)}-${pad(today.getDate())}`
  onChange({ date, time: `${pad(patch.hour ?? hour24)}:${patch.minute ?? minute}` })
 }
 const first = new Date(month.y, month.m, 1).getDay(), count = new Date(month.y, month.m + 1, 0).getDate()
 const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
 const chip = (text: string, selected: boolean, onPress: () => void, key = text, a11y = text) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected }} onPress={onPress}
  style={{ minWidth: 40, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', backgroundColor: selected ? brand.primary : brand.card, borderWidth: 1, borderColor: selected ? brand.primary : brand.line }}>
  <Text style={{ color: selected ? brand.page : brand.ink, fontFamily: fonts.label, fontSize: 14 }}>{text}</Text>
 </TouchableOpacity>
 let shown = 'Choose date and time'
 try { if (value) shown = formatEventTime(wallTimeToIso(value), EVENT_TZ, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch {}

 return <View style={{ gap: 8 }}>
  {!!label && <Text style={[styles.text, { color: brand.ink, fontFamily: fonts.label }]}>{label}</Text>}
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label || 'Date and time'}: ${shown}`} onPress={() => setOpen(!open)} style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between' }]}>
   <Text style={{ color: value ? brand.ink : brand.inkMuted, fontSize: 16 }}>{shown}</Text><Text style={{ color: brand.primary, fontFamily: fonts.label }}>{open ? 'Done' : 'Change'}</Text>
  </TouchableOpacity>
  {open && <View style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: brand.page, borderWidth: 1, borderColor: brand.line }}>
   <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(month.m ? { y: month.y, m: month.m - 1 } : { y: month.y - 1, m: 11 })}><Text style={{ fontSize: 22, color: brand.primary, paddingHorizontal: 10 }}>‹</Text></TouchableOpacity>
    <Text style={{ fontFamily: fonts.heading, color: brand.ink, fontSize: 16 }}>{new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(month.m === 11 ? { y: month.y + 1, m: 0 } : { y: month.y, m: month.m + 1 })}><Text style={{ fontSize: 22, color: brand.primary, paddingHorizontal: 10 }}>›</Text></TouchableOpacity>
   </View>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
    {DAYS.map((d, i) => <Text key={`h${i}`} style={{ width: '14.28%', textAlign: 'center', color: brand.inkMuted, fontSize: 12, fontFamily: fonts.label }}>{d}</Text>)}
    {cells.map((day, i) => {
     const date = day ? `${month.y}-${pad(month.m + 1)}-${pad(day)}` : ''
     const selected = !!day && value?.date === date
     return <View key={i} style={{ width: '14.28%', alignItems: 'center', paddingVertical: 3 }}>
      {day ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={new Date(month.y, month.m, day).toDateString()} accessibilityState={{ selected }} onPress={() => set({ date })}
       style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? brand.primary : 'transparent' }}>
       <Text style={{ color: selected ? brand.page : brand.ink, fontSize: 15 }}>{day}</Text></TouchableOpacity> : null}
     </View>
    })}
   </View>
   <Text style={[styles.text, { fontFamily: fonts.label }]}>Time</Text>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{Array.from({ length: 12 }, (_, i) => i + 1).map(h => chip(String(h), h === hour12, () => set({ hour: (h % 12) + (pm ? 12 : 0) }), `h${h}`, `${h} o'clock`))}</View>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
    {MINUTES.map(m => chip(`:${m}`, m === minute, () => set({ minute: m }), `m${m}`, `${m} minutes`))}
    {chip('AM', !pm, () => set({ hour: hour12 % 12 }))}{chip('PM', pm, () => set({ hour: (hour12 % 12) + 12 }))}
   </View>
   <Text style={styles.text}>Times are Detroit time (Eastern).</Text>
   {optional && value && <TouchableOpacity accessibilityRole="button" onPress={() => { onChange(null); setOpen(false) }}><Text style={{ color: brand.danger, fontFamily: fonts.label }}>Clear</Text></TouchableOpacity>}
  </View>}
 </View>
}
