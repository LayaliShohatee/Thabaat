export function authRedirect(signedIn: boolean, segments: readonly string[]) {
  const authPage = segments[0] === 'auth' ? segments[1] : undefined
  const publicAuth = ['login', 'register', 'forgot-password', 'callback', 'reset-password']
  if (!signedIn && !publicAuth.includes(authPage ?? '')) return '/auth/login' as const
  if (signedIn && ['login', 'register', 'forgot-password'].includes(authPage ?? '')) return '/(tabs)' as const
  return null
}

export function parseAuthLink(url: string) {
  const parsed = new URL(url)
  const params = new URLSearchParams(parsed.search)
  new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => params.set(key, value))
  return {
    error: params.get('error_description') || params.get('error'),
    code: params.get('code'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    recovery: params.get('type') === 'recovery' || parsed.pathname.includes('reset-password'),
  }
}
