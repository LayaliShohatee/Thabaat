import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { AppState } from 'react-native'

// A stale request must not overwrite data after leaving a screen or retrying.
export function useFocusResource<T>(loader: () => Promise<T>, initial: T, refreshIntervalMs = 0) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef(0)
  const fetching = useRef(false)
  const fetchResource = useCallback(async (quiet = false) => {
    if (quiet && fetching.current) return
    fetching.current = true
    const current = ++request.current
    if (!quiet) setLoading(true)
    setError('')
    try {
      const next = await loader()
      if (current === request.current) setData(next)
    } catch (err) {
      if (current === request.current) setError(err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : 'Unable to load data. Please try again.')
    } finally {
      if (current === request.current) { fetching.current = false; setLoading(false) }
    }
  }, [loader])
  const reload = useCallback(() => fetchResource(false), [fetchResource])
  useFocusEffect(useCallback(() => {
    void reload()
    const refresh = () => { if (AppState.currentState === 'active') void fetchResource(true) }
    const timer = refreshIntervalMs > 0 ? setInterval(refresh, refreshIntervalMs) : null
    const subscription = refreshIntervalMs > 0 ? AppState.addEventListener('change', state => { if (state === 'active') refresh() }) : null
    return () => {
      request.current++; fetching.current = false
      if (timer !== null) clearInterval(timer)
      subscription?.remove()
    }
  }, [reload, fetchResource, refreshIntervalMs]))
  return { data, loading, error, reload }
}
