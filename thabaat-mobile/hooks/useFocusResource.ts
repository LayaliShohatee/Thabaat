import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'

// A stale request must not overwrite data after leaving a screen or retrying.
export function useFocusResource<T>(loader: () => Promise<T>, initial: T) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef(0)
  const reload = useCallback(async () => {
    const current = ++request.current
    setLoading(true)
    setError('')
    try {
      const next = await loader()
      if (current === request.current) setData(next)
    } catch (err) {
      if (current === request.current) setError(err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : 'Unable to load data. Please try again.')
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [loader])
  useFocusEffect(useCallback(() => {
    void reload()
    return () => { request.current++ }
  }, [reload]))
  return { data, loading, error, reload }
}
