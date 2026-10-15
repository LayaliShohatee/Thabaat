import type { PropsWithChildren } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useReducedMotion } from 'react-native-reanimated'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)

function enteringFor(order: number, reduced: boolean) {
  const delay = order * 50
  if (reduced) return FadeIn.duration(200).delay(delay).reduceMotion(ReduceMotion.Never)
  const fadeUp = FadeInDown.duration(240).delay(delay).easing(EASE_OUT)
  // On phones, rise just 8pt. Reanimated's web build stalls on custom start values, so the web preview uses the preset (25pt).
  return process.env.EXPO_OS === 'web' ? fadeUp : fadeUp.withInitialValues({ opacity: 0, translateY: 8 })
}

// Fades content up over 240ms; `order` staggers siblings by 50ms. Reduce Motion: a 200ms fade in place.
export function Rise({ children, order = 0, style }: PropsWithChildren<{ order?: number; style?: StyleProp<ViewStyle> }>) {
  const reduced = useReducedMotion()
  return <Animated.View entering={enteringFor(order, reduced)} style={style}>{children}</Animated.View>
}
