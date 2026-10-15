import { useState } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
// Strong ease-out: starts fast so the press registers immediately, then settles.
const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1)

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }

// Any tappable thing: shrinks to 97% the moment a finger touches it and springs back on release (120ms).
// With Reduce Motion on, it dims slightly instead of moving.
export function PressableScale({ style, onPressIn, onPressOut, disabled, ...props }: Props) {
  const [pressed, setPressed] = useState(false)
  const reduced = useReducedMotion()
  const active = pressed && !disabled
  return <AnimatedPressable
    {...props}
    disabled={disabled}
    pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
    onPressIn={e => { setPressed(true); onPressIn?.(e) }}
    onPressOut={e => { setPressed(false); onPressOut?.(e) }}
    style={[style, {
      transform: [{ scale: active && !reduced ? 0.97 : 1 }],
      opacity: active && reduced ? 0.85 : disabled ? 0.5 : 1,
      transitionProperty: ['transform', 'opacity'],
      transitionDuration: 120,
      transitionTimingFunction: EASE_OUT,
    }]}
  />
}
