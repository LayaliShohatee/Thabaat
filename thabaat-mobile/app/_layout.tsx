import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAuth } from '@/hooks/useAuth'

export const unstable_settings = {
  anchor: '(tabs)',
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const { user, loading } = useAuth()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === 'auth'

    if (!user && !inAuthGroup) {
      router.replace('/auth/login')
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [user, loading, segments])

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="registration/[eventId]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}