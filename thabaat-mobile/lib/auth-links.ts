import * as Linking from 'expo-linking'
import { supabase } from './supabase'
import { parseAuthLink } from './auth-routing'

export function authRedirectUrl(path: 'callback' | 'reset-password') {
  return Linking.createURL(`auth/${path}`)
}

let lastUrl: string | null = null
let pending: Promise<boolean> | null = null

export function consumeAuthLink(url: string): Promise<boolean> {
  if (url === lastUrl && pending) return pending
  lastUrl = url
  const request = (async () => {
    const link = parseAuthLink(url)
    if (link.error) throw new Error(link.error)
    if (link.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(link.code)
      if (error) throw error
    } else if (link.accessToken && link.refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
      if (error) throw error
    }
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!data.session) throw new Error('This link is missing or expired. Request a new email link.')
    return link.recovery
  })()
  pending = request
  // A failed exchange must be retryable (for example after restoring Wi-Fi).
  // Do not let an older failure discard a newer link's request.
  void request.catch(() => {
    if (pending === request) { lastUrl = null; pending = null }
  })
  return request
}
