import { useState } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
// Strong ease-out: starts fast so the press registers immediately, then settles.
const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1)

// haptic="selection": a light tick when a choice changes (segments, pickers, filters). iOS/Android only, one per tap.
type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; haptic?: 'selection' }

// Any tappable thing: shrinks to 97% the moment a finger touches it and springs back on release (120ms).
// With Reduce Motion on, it dims slightly instead of moving.
export function PressableScale({ style, onPressIn, onPressOut, onPress, disabled, haptic, ...props }: Props) {
  const [pressed, setPressed] = useState(false)
  const reduced = useReducedMotion()
  const active = pressed && !disabled
  return <AnimatedPressable
    {...props}
    disabled={disabled}
    pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
    onPressIn={e => { setPressed(true); onPressIn?.(e) }}
    onPressOut={e => { setPressed(false); onPressOut?.(e) }}
    onPress={onPress && (e => { if (haptic && process.env.EXPO_OS !== 'web') void Haptics.selectionAsync().catch(() => {}); onPress(e) })}
    style={[style, {
      transform: [{ scale: active && !reduced ? 0.97 : 1 }],
      opacity: active && reduced ? 0.85 : disabled ? 0.5 : 1,
      transitionProperty: ['transform', 'opacity'],
      transitionDuration: 120,
      transitionTimingFunction: EASE_OUT,
    }]}
  />
}
