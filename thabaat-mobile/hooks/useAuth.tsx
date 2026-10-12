import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { AppState, Platform } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true })

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    let receivedEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedEvent = true
      if (active) { setSession(nextSession); setLoading(false) }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedEvent) setSession(error ? null : data.session)
    }).catch(() => {
      if (active && !receivedEvent) setSession(null)
    }).finally(() => { if (active) setLoading(false) })
    const refresh = (state: string) => {
      if (state === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    }
    const appState = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null
    if (Platform.OS !== 'web') refresh(AppState.currentState)
    return () => {
      active = false
      subscription.unsubscribe()
      appState?.remove()
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh()
    }
  }, [])
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const state = useContext(AuthContext)
  return { ...state, user: state.session?.user ?? null }
}
