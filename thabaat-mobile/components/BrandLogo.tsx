import { Image, type ImageStyle } from 'expo-image'
import type { StyleProp } from 'react-native'

// The official Thabaat logo (October 5, 2026), rendered from the SVG masters in assets/brand.
// "full-colour" (forest letters, teal marks) on cream grounds; "reverse" (cream letters) on forest grounds.
// Keep 24px of clear space around it and never retype, stretch or recolour it (see docs/BRAND.md).
const SOURCES = {
  lockup: {
    'full-colour': require('@/assets/brand/lockup-horizontal-full-colour.png'),
    reverse: require('@/assets/brand/lockup-horizontal-reverse.png'),
  },
  icon: {
    'full-colour': require('@/assets/brand/icon-full-colour.png'),
    reverse: require('@/assets/brand/icon-reverse.png'),
  },
} as const
const RATIO = { lockup: 1369.1 / 348.8, icon: 521.5 / 696 } as const

type Props = {
  variant?: keyof typeof SOURCES
  ink?: 'full-colour' | 'reverse'
  height?: number
  style?: StyleProp<ImageStyle>
}

export function BrandLogo({ variant = 'lockup', ink = 'full-colour', height = 32, style }: Props) {
  return (
    <Image
      source={SOURCES[variant][ink]}
      contentFit="contain"
      accessibilityLabel="Thabaat"
      style={[{ height, width: Math.round(height * RATIO[variant]) }, style]}
    />
  )
}
