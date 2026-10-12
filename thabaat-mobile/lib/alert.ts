import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native'

// React Native Web's Alert.alert is a no-op. Preserve feedback and callbacks.
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons)
    if (typeof window === 'undefined') return
    const text = [title, message].filter(Boolean).join('\n\n')
    const action = buttons?.find(button => button.style !== 'cancel')
    if (buttons && buttons.length > 1) {
      if (window.confirm(text)) action?.onPress?.()
    } else {
      window.alert(text)
      action?.onPress?.()
    }
  },
}
