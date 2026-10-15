import type { PropsWithChildren } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
// Opacity only: nothing moves, so this also suits Reduce Motion (fades help show what changed).
const ENTER = FadeIn.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.Never)
const EXIT = FadeOut.duration(120).easing(EASE_OUT).reduceMotion(ReduceMotion.Never)

// Wrap content that appears when something is opened (an answer, a panel, a list) so it fades in instead of popping.
export function Reveal({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <Animated.View entering={ENTER} exiting={EXIT} style={style}>{children}</Animated.View>
}
