// worker/src/lib/auth.ts

const PBKDF2_ITERATIONS = 100_000

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const hash = new Uint8Array(bits)
  const combined = new Uint8Array(salt.length + hash.length)
  combined.set(salt)
  combined.set(hash, salt.length)
  return btoa(String.fromCharCode(...combined))
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const enc = new TextEncoder()
  const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
  const salt = combined.slice(0, 16)
  const storedHash = combined.slice(16)
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const hash = new Uint8Array(bits)
  // Constant-time comparison
  if (hash.length !== storedHash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ storedHash[i]
  return diff === 0
}

export async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 30 }))
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return `${data}.${sigB64}`
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const enc = new TextEncoder()
    const data = `${header}.${body}`
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
    if (!valid) return null
    const payload = JSON.parse(atob(body)) as Record<string, unknown>
    if ((payload.exp as number) < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function createDownloadToken(
  orderId: string, productId: number, secret: string
): Promise<string> {
  const payload = { orderId, productId, exp: Math.floor(Date.now() / 1000) + 3600 * 48 }
  const enc = new TextEncoder()
  const data = btoa(JSON.stringify(payload))
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${data}.${sigHex}`
}
