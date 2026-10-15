import { useEffect } from 'react'
import { Text, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { brand, fonts } from '@/constants/brand'

// The check on "You're registered": settles in with a gentle spring and a success haptic in the same moment.
// Rare (once per booking), so a little bounce is welcome. Reduce Motion: a 200ms fade, no scale; the haptic stays.
export function SuccessMark() {
  const reduced = useReducedMotion()
  const scale = useSharedValue(reduced ? 1 : 0.9)
  const opacity = useSharedValue(0)
  useEffect(() => {
    opacity.set(withTiming(1, { duration: 200 }))
    if (!reduced) scale.set(withSpring(1, { duration: 400, dampingRatio: 0.7 }))
    if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  }, [opacity, scale, reduced])
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }))
  return <Animated.View accessible={false} style={[styles.circle, style]}><Text style={styles.check}>✓</Text></Animated.View>
}

const styles = StyleSheet.create({
  circle: { width: 76, height: 76, borderRadius: 38, backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  check: { fontSize: 38, color: '#FFFFFF', fontFamily: fonts.headingHeavy, lineHeight: 44 },
})
