/**
 * Plummer — Cloudflare Worker Link Shortener
 *
 * Required KV binding : LINKIVERSE
 * Required secret     : ADMIN_SECRET  (npx wrangler secret put ADMIN_SECRET)
 *
 * KV schema — key: "link:{slug}"
 * Value (JSON):
 *   {
 *     slug        : string,
 *     guest       : string,   // destination URL
 *     passwordHash: string|null,  // SHA-256 of password, or null
 *     expiresAt   : number|null,  // Unix ms timestamp, or null
 *     clicks      : number,
 *     createdAt   : number        // Unix ms timestamp
 *   }
 */

import { routeRequest } from './router.js';
import { addSecurityHeaders } from './security.js';
import { getAllLinks, deleteLink } from './kv.js';
import { writeAudit } from './audit.js';

export default {
  async fetch(request, env, ctx) {
    // Attach ctx so handlers can use waitUntil
    env.ctx = ctx;
    const response = await routeRequest(request, env);
    return addSecurityHeaders(response);
  },

  async scheduled(_event, env, ctx) {
    // Purge tombstoned links after purgeAfter timestamp.
    const links = await getAllLinks(env);
    const now = Date.now();
    for (const link of links) {
      if (link?.status !== 'deleted') continue;
      if (!link?.purgeAfter || typeof link.purgeAfter !== 'number') continue;
      if (link.purgeAfter > now) continue;
      if (!link.host || !link.slug) continue;
      ctx.waitUntil(deleteLink(env, link.host, link.slug));
      ctx.waitUntil(writeAudit(env, {
        action: 'link.purge',
        host: link.host,
        slug: link.slug,
        before: link,
        actor: { ip: null, ua: null, ray: null },
      }));
    }
  },
};

