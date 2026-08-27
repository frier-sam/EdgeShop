// Shared fetch helper for TanStack Query `queryFn`s.
//
// Plain `fetch()` never rejects on a non-2xx response, so call sites used to
// hand-roll `if (!r.ok) throw new Error('Not found')`. That loses the HTTP
// status code by the time the error reaches `QueryClient`'s `retry`
// callback (App.tsx) — every failure looked identical, so a permanent 404
// (e.g. `/product/1` for a product that doesn't exist) was retried exactly
// like a transient 500 or a dropped connection: 3 attempts with exponential
// backoff, ~7s of skeleton before the "not found" UI could ever render.
//
// `fetchJson` throws `ApiError` (carrying the real `status`) instead, so the
// retry policy can tell "this will never succeed" (4xx) apart from "this
// might succeed on the next attempt" (5xx / network failure).

export class ApiError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

// Narrower than `fetch`'s real signature (`RequestInfo | URL`) so that
// `adminFetch` — which only accepts a `string` url — is assignable here too;
// every call site in this codebase passes a string anyway.
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

/**
 * `fetchJson` built on a caller-supplied fetcher — used by admin query
 * functions, which need `adminFetch` (injects the bearer token) instead of
 * plain `fetch` but still want the same ApiError/status behaviour.
 */
export async function fetchJsonWith<T>(fetcher: Fetcher, input: string, init?: RequestInit): Promise<T> {
  const res = await fetcher(input, init)
  if (!res.ok) {
    // Worker routes return `{ error: string }` on failure (see
    // worker/src/routes/**) — surface that message when present, but never
    // let a non-JSON or empty error body hide the real status.
    let message: string | undefined
    try {
      const body: unknown = await res.clone().json()
      if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
        message = (body as { error: string }).error
      }
    } catch {
      // non-JSON error body — fall back to the generic status message.
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

/** `fetchJson` over the plain, unauthenticated `fetch` — the storefront default. */
export function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  return fetchJsonWith(fetch, input, init)
}

/**
 * `QueryClient` `retry` policy (wired up in App.tsx) — see the module
 * comment above for why this needs `ApiError` instead of inspecting
 * `Error.message`.
 *
 * - 4xx (including 404/401/403) is not transient: never retry, so a missing
 *   product or an expired session reaches its error UI immediately instead
 *   of after 3 doomed retries.
 * - 5xx, and anything that isn't an `ApiError` at all (a `TypeError: Failed
 *   to fetch` from being offline, a dropped connection, a JSON parse
 *   failure), might succeed on a retry: allow a couple of attempts with
 *   TanStack Query's default exponential backoff.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 2
}
