import { ADMIN_REALM, SECURITY_HEADERS } from './constants.js';
import { safeEqual, sha256 } from './util.js';

/** Check HTTP Basic Auth against env.ADMIN_SECRET. Returns true if valid. */
export async function checkAdminAuth(request, env) {
  if (!env.ADMIN_SECRET) return false;
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = atob(auth.slice(6));
  } catch {
    return false;
  }
  const colon = decoded.indexOf(':');
  if (colon === -1) return false;
  const password = decoded.slice(colon + 1);
  // Compare hashes to get a fixed-length comparison (mitigates timing leaks)
  const [submittedHash, secretHash] = await Promise.all([
    sha256(password),
    sha256(env.ADMIN_SECRET),
  ]);
  return safeEqual(submittedHash, secretHash);
}

/** Returns a 401 response that prompts Basic Auth in the browser. */
export function unauthorizedResponse() {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain',
    },
  });
}

export function addSecurityHeaders(response) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  return r;
}

