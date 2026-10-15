import { useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'

// Light screens need dark status-bar text; the app default is light text for the navy headers.
// While this screen is focused the status bar uses `style`, and goes back to light when it isn't.
export function useStatusBarStyle(style: 'dark' | 'light') {
  useFocusEffect(useCallback(() => {
    setStatusBarStyle(style, true)
    return () => setStatusBarStyle('light', true)
  }, [style]))
}
