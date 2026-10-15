import { useState } from 'react'
import { Linking, ScrollView, Text, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { brand, fonts, links } from '@/constants/brand'
import { managementStyles as styles } from '@/components/ManagementUI'
import { Reveal } from '@/components/Reveal'
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated'

// Draft answers built from thabaat.org and the app's behaviour. The client should review the wording before release.
export const faqs: { q: string; a: string }[] = [
 { q: 'What is Thabaat?', a: 'Thabaat is a community for young professionals in Southeast Michigan, helping them grow socially, spiritually and professionally. It is brought to you by Miftaah Institute.' },
 { q: 'Who can attend events?', a: 'Thabaat events are for ages 23 and up. Our monthly Qiyam nights are open to all ages. Each event page lists its own age range.' },
 { q: 'How do I register for an event?', a: 'Open the Events tab, choose an event and tap Register. Your ticket appears under Events → My tickets.' },
 { q: 'How do I check in at the event?', a: 'Just give your name at the door and a volunteer will check you in. You can also show the QR code from Events → My tickets.' },
 { q: 'Can I cancel my registration?', a: 'Yes. Open Events → My tickets and cancel a free registration before the event starts. Paid tickets can request a refund from the same screen.' },
 { q: 'I forgot to register. Can I still come?', a: 'Please register in the app if spots remain. If you arrive without registering, a volunteer at the door can add you as a walk-in while space allows.' },
 { q: 'How can I volunteer?', a: 'Open any upcoming event and tap Volunteer for this event. The team will confirm your spot, and your role will show in the Team tab.' },
 { q: 'How do I support Thabaat?', a: 'You can donate from Account → More → Support Thabaat, or on thabaat.org.' },
 { q: 'How do I contact the team?', a: `Email ${links.email}. You can also follow us on social media for updates.` },
]

export default function FaqScreen() {
 const [open, setOpen] = useState<number | null>(0)
 const reduced = useReducedMotion()
 return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: 20 }]}>
  <Text style={styles.title}>Questions? We’ve got you.</Text>
  {faqs.map((item, index) => <View key={item.q} style={[styles.card, { gap: 8, paddingVertical: 14 }]}>
   <PressableScale accessibilityRole="button" accessibilityState={{ expanded: open === index }} onPress={() => setOpen(open === index ? null : index)} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
    <Text style={[styles.heading, { flex: 1, fontSize: 16 }]}>{item.q}</Text>
    <Animated.Text style={{ color: brand.primary, fontFamily: fonts.heading, fontSize: 20, transform: [{ rotate: open === index && !reduced ? '45deg' : '0deg' }], transitionProperty: 'transform', transitionDuration: 180, transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1) }}>{reduced && open === index ? '×' : '+'}</Animated.Text>
   </PressableScale>
   {open === index && <Reveal><Text style={styles.text}>{item.a}</Text></Reveal>}
  </View>)}
  <PressableScale accessibilityRole="button" onPress={() => void Linking.openURL(`mailto:${links.email}`)}><Text style={{ color: brand.primary, fontFamily: fonts.label, textAlign: 'center', fontSize: 15 }}>Still stuck? Email {links.email}</Text></PressableScale>
 </ScrollView>
}
