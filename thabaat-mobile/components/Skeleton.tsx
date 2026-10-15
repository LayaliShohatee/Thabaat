import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
import { brand } from '@/constants/brand'

const PULSE = { from: { opacity: 1 }, '50%': { opacity: 0.6 }, to: { opacity: 1 } }

// A grey block that gently pulses while content loads (900ms, linear, on the UI thread). Reduce Motion: static.
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  return <Animated.View style={[styles.block, style, reduced
    ? { opacity: 0.8 }
    : { animationName: PULSE, animationDuration: 900, animationIterationCount: 'infinite', animationTimingFunction: 'linear' }]} />
}

// Placeholder in the shape of an event card, so the layout doesn't jump when real cards arrive.
export function EventCardSkeleton() {
  return <View accessibilityLabel="Loading event" style={styles.card}>
    <SkeletonBlock style={{ height: 120, borderRadius: 0 }} />
    <View style={{ padding: 16, paddingTop: 30, gap: 10 }}>
      <SkeletonBlock style={{ height: 18, width: '70%' }} />
      <SkeletonBlock style={{ height: 14, width: '45%' }} />
      <SkeletonBlock style={{ height: 14, width: '35%' }} />
    </View>
  </View>
}

const styles = StyleSheet.create({
  block: { backgroundColor: brand.line, borderRadius: 8 },
  card: { marginHorizontal: 16, marginVertical: 8, backgroundColor: brand.card, borderRadius: brand.radius, borderWidth: 1, borderColor: brand.line, overflow: 'hidden' },
})
