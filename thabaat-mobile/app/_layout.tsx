import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { Stack, router, useSegments, usePathname, useGlobalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useFonts, Montserrat_600SemiBold, Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat'
import * as SplashScreen from 'expo-splash-screen'
import 'react-native-reanimated'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { authRedirect } from '@/lib/auth-routing'
import {eventIdFromPath} from '@/lib/event-sharing'
import { isDemoMode } from '@/lib/demo-mode'
import { brand, fonts } from '@/constants/brand'

SplashScreen.preventAutoHideAsync().catch(() => {})

// Every screen is drawn in the light brand palette, so navigation uses it too, even when the phone is in dark mode.
// (A real dark palette would be its own project.)
const lightTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: brand.page, card: brand.card, primary: brand.primary, text: brand.ink, border: brand.line } }

export const unstable_settings = {
  anchor: '(tabs)',
}

function Navigation() {
  const { user, loading } = useAuth()
  const segments = useSegments()
  const pathname=usePathname()
  const params=useGlobalSearchParams<{eventId?:string}>()

  useEffect(() => {
    if (loading) return

    const destination = authRedirect(Boolean(user), segments, params.eventId)
    if (destination) {
      const returnEventId=eventIdFromPath(pathname)
      if(destination==='/auth/login'&&returnEventId)router.replace({pathname:'/auth/login',params:{eventId:returnEventId}})
      else router.replace(destination)
    }
  }, [user, loading, segments, pathname, params.eventId])

  return (
    <ThemeProvider value={lightTheme}>
      <Stack screenOptions={{headerBackButtonDisplayMode:isDemoMode?'minimal':'default',headerBackTitle:'Back',headerStyle:{backgroundColor:brand.navy},headerTintColor:'#FFFFFF',headerTitleStyle:{fontFamily:fonts.heading,fontSize:17},headerShadowVisible:false}}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="auth/forgot-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="auth/reset-password" options={{ title: 'New password' }} />
        <Stack.Screen name="auth/change-password" options={{ title: 'Change password' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="membership" options={{ title: 'Membership' }} />
        <Stack.Screen name="membership-preview" options={{ title: 'Membership practice · No charges' }} />
        <Stack.Screen name="donations" options={{ title: 'Support Thabaat' }} />
        <Stack.Screen name="payments/history" options={{ title: 'Payment History' }} />
        <Stack.Screen name="paid" options={{ title: 'Payment status' }} />
        <Stack.Screen name="payments/event/[eventId]" options={{ title: 'Paid Event Checkout' }} />
        <Stack.Screen name="event/access/[id]" options={{ title: 'Event Access' }} />
        <Stack.Screen name="payments/check" options={{ title: 'Payment Check' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="registration/[eventId]" options={{ title: 'Register' }} />
        <Stack.Screen name="registration/confirmation" options={{ headerShown: false }} />
        <Stack.Screen name="faq" options={{ title: 'FAQ' }} />
        <Stack.Screen name="more" options={{ title: 'More' }} />
        <Stack.Screen name="admin/roles" options={{ title: 'Roles and access' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  )

}

export default function RootLayout() {
  // Montserrat matches thabaat.org. If loading fails the app still renders with the system font.
  const [fontsLoaded, fontError] = useFonts({ Montserrat_600SemiBold, Montserrat_700Bold, Montserrat_800ExtraBold })
  useEffect(() => { if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {}) }, [fontsLoaded, fontError])
  if (!fontsLoaded && !fontError) return null
  return <AuthProvider><Navigation /></AuthProvider>
}
