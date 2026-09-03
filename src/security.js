import { ADMIN_REALM, SECURITY_HEADERS } from './constants.js'
import { safeEqual, sha256 } from './util.js'

import { getApiKey } from './kv.js'

export async function checkApiKeyAuth (request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return { valid: false }

  const token = auth.slice(7)
  if (!token) return { valid: false }

  // Parse id.secret token format for O(1) lookup
  const parts = token.split('.')
  if (parts.length !== 2) return { valid: false }

  const [id, secret] = parts
  const tokenHash = await sha256(secret)

  // The host is required for the API Key KV lookup format: apikey:<host>:<id>
  // However, API keys may be global or specific to a host.
  // We need to parse the host from the request, or the token must include it.
  // Actually, we can get the host from the request headers to do O(1) lookup.
  const host = (request.headers.get('host') ?? new URL(request.url).host).trim().toLowerCase()

  const key = await getApiKey(env, host, id)
  if (key && safeEqual(key.secretHash, tokenHash)) {
    if (key.expiresAt && Date.now() > key.expiresAt) {
      return { valid: false, reason: 'Key expired' }
    }
    return { valid: true, key }
  }

  return { valid: false }
}

export function apiUnauthorizedResponse (message = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 })
}

/** Check HTTP Basic Auth against env.ADMIN_SECRET. Returns true if valid. */
export async function checkAdminAuth (request, env) {
  if (!env.ADMIN_SECRET) return false
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Basic ')) return false
  let decoded
  try {
    decoded = atob(auth.slice(6))
  } catch {
    return false
  }
  const colon = decoded.indexOf(':')
  if (colon === -1) return false
  const password = decoded.slice(colon + 1)
  // Compare hashes to get a fixed-length comparison (mitigates timing leaks)
  const [submittedHash, secretHash] = await Promise.all([
    sha256(password),
    sha256(env.ADMIN_SECRET)
  ])
  return safeEqual(submittedHash, secretHash)
}

/** Returns a 401 response that prompts Basic Auth in the browser. */
export function unauthorizedResponse () {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain'
    }
  })
}

export function addSecurityHeaders (response) {
  const r = new Response(response.body, response)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v)
  return r
}
