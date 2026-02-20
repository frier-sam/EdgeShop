/**
 * Wrapper around fetch that automatically injects the admin auth token.
 * Reads directly from localStorage to avoid circular imports with Zustand.
 */
export function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token: string | null = null
  try {
    const raw = localStorage.getItem('admin-auth')
    if (raw) token = JSON.parse(raw).state?.adminToken ?? null
  } catch {}

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
