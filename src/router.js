import { RESERVED } from './constants.js';
import {
  deleteFolder,
  deleteLink,
  getAllLinks,
  getFolder,
  getLink,
  listFolders,
  listLinksByFolder,
  normalizeHost,
  putFolder,
  putLink,
} from './kv.js';
import { adminPage } from './pages/admin.js';
import { homePage } from './pages/home.js';
import { deletedPage, expiredPage, inactivePage, misconfiguredPage, notFoundPage, passwordPage } from './pages/errors.js';
import { folderListingPage } from './pages/folders.js';
import { heartbeatPage } from './pages/heartbeat.js';
import { checkAdminAuth, unauthorizedResponse } from './security.js';
import { isValidUrl, safeEqual, sha256 } from './util.js';
import { getActor, listAudit, writeAudit } from './audit.js';

function getAllowedHosts(env) {
  const raw = env.ALLOWED_HOSTS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((h) => normalizeHost(h)).filter(Boolean);
  } catch {
    return [];
  }
}

async function handleHomePage(origin) {
  return new Response(homePage(origin), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleAdminPage(_request, env, origin) {
  const links = await getAllLinks(env);
  const allowedHosts = getAllowedHosts(env);
  return new Response(adminPage(links, origin, allowedHosts), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleAPI(request, env, pathname) {
  const allowedHosts = getAllowedHosts(env);
  const actor = getActor(request);
  const requestHost = normalizeHost(request.headers.get('host') ?? new URL(request.url).host);
  const debugEnabled = env.ENABLE_DEBUG_ENDPOINTS === true || env.ENABLE_DEBUG_ENDPOINTS === 'true';

  async function requireDebugAccess() {
    if (!debugEnabled) return { ok: false, response: Response.json({ error: 'Not Found' }, { status: 404 }) };
    // Defense-in-depth: require Basic Auth even if routing/auth changes later.
    const ok = await checkAdminAuth(request, env);
    if (!ok) return { ok: false, response: unauthorizedResponse() };
    return { ok: true };
  }

  function assertHostAllowed(host) {
    if (!host) return { ok: false, response: Response.json({ error: 'host is required' }, { status: 400 }) };
    if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
      return {
        ok: false,
        response: Response.json({ error: `"${host}" is not an allowed host` }, { status: 400 }),
      };
    }
    // Safer default: if no allowlist is configured, only allow the current request host.
    // This prevents creating/updating records under arbitrary host-scoped keys.
    if (allowedHosts.length === 0 && host !== requestHost) {
      return {
        ok: false,
        response: Response.json(
          { error: `Host "${host}" is not allowed (no ALLOWED_HOSTS_JSON configured; expected "${requestHost}")` },
          { status: 400 },
        ),
      };
    }
    return { ok: true };
  }

  // GET /api/debug/link?host=...&slug=...
  // Temporary debugging helper for KV key issues in dev.
  if (pathname === '/api/debug/link' && request.method === 'GET') {
    const access = await requireDebugAccess();
    if (!access.ok) return access.response;
    const url = new URL(request.url);
    const host = normalizeHost(url.searchParams.get('host'));
    const slug = url.searchParams.get('slug');
    if (!host || !slug) return Response.json({ error: 'host and slug are required' }, { status: 400 });

    const keysToCheck = [
      `link:${host}:${slug}`,
      `link:${host.replace(/:\\d+$/, '')}:${slug}`,
      `link:${slug}`,
    ];

    const results = {};
    for (const k of keysToCheck) {
      const v = await env.LINKIVERSE.get(k);
      results[k] = v ? { found: true, sample: v.slice(0, 200) } : { found: false };
    }

    // Also list a few keys containing the slug suffix.
    const matches = [];
    let cursor;
    do {
      const page = await env.LINKIVERSE.list({ prefix: 'link:', limit: 100, cursor });
      for (const key of page.keys) {
        if (key.name.endsWith(`:${slug}`) || key.name === `link:${slug}`) matches.push(key.name);
        if (matches.length >= 20) break;
      }
      if (matches.length >= 20) break;
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    return Response.json({ host, slug, keysToCheck, results, matches });
  }

  // GET /api/debug/getlink?host=...&slug=...
  // Returns the result of getLink() vs a direct KV get for the canonical key.
  if (pathname === '/api/debug/getlink' && request.method === 'GET') {
    const access = await requireDebugAccess();
    if (!access.ok) return access.response;
    const url = new URL(request.url);
    const host = normalizeHost(url.searchParams.get('host'));
    const slug = url.searchParams.get('slug');
    if (!host || !slug) return Response.json({ error: 'host and slug are required' }, { status: 400 });

    const viaHelper = await getLink(env, host, slug);
    const canonicalKey = `link:${host}:${slug}`;
    const raw = await env.LINKIVERSE.get(canonicalKey);
    let parsedRaw = null;
    try { parsedRaw = raw ? JSON.parse(raw) : null; } catch { parsedRaw = null; }

    return Response.json({
      host,
      slug,
      canonicalKey,
      getLinkFound: Boolean(viaHelper),
      getLinkSample: viaHelper ? JSON.stringify(viaHelper).slice(0, 200) : null,
      directFound: Boolean(raw),
      directSample: raw ? raw.slice(0, 200) : null,
      directParsedSample: parsedRaw ? JSON.stringify(parsedRaw).slice(0, 200) : null,
    });
  }

  // GET /api/debug/redirect-lookup?slug=...
  // Uses the incoming request's host/url like handleRedirect does, then runs getLink().
  if (pathname === '/api/debug/redirect-lookup' && request.method === 'GET') {
    const access = await requireDebugAccess();
    if (!access.ok) return access.response;
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 });
    const hostHeader = request.headers.get('host');
    const computedHost = normalizeHost(hostHeader ?? url.host);
    const found = await getLink(env, computedHost, slug);
    return Response.json({
      slug,
      hostHeader,
      urlHost: url.host,
      computedHost,
      canonicalKey: `link:${computedHost}:${slug}`,
      found: Boolean(found),
      sample: found ? JSON.stringify(found).slice(0, 200) : null,
    });
  }

  // POST /api/debug/force-delete?host=...&slug=...
  // Testing-only endpoint: immediately removes KV entries for a link.
  // Gated behind FORCE_DELETE_KEY (set locally via .dev.vars and in prod via wrangler secret).
  // Also requires ENABLE_DEBUG_ENDPOINTS=true to avoid accidental exposure in production.
  //
  // Provide key via header `x-force-delete-key` OR query param `key` (header recommended).
  if (pathname === '/api/debug/force-delete' && request.method === 'POST') {
    // Require FORCE_DELETE_KEY to be configured for this operation to exist.
    if (!env.FORCE_DELETE_KEY) {
      return Response.json({ error: 'FORCE_DELETE_KEY is not configured' }, { status: 404 });
    }

    const url = new URL(request.url);
    const host = normalizeHost(url.searchParams.get('host'));
    const slug = url.searchParams.get('slug');
    if (!host || !slug) return Response.json({ error: 'host and slug are required' }, { status: 400 });

    // Allow either a matching FORCE_DELETE_KEY (header `x-force-delete-key` OR query `key`)
    // OR valid Basic Auth via `requireDebugAccess()`. This avoids applying blanket
    // Basic Auth rules to all `/api/*` routes while still protecting this destructive
    // endpoint.
    const provided = request.headers.get('x-force-delete-key') ?? url.searchParams.get('key') ?? '';
    const [providedHash, expectedHash] = await Promise.all([sha256(provided), sha256(env.FORCE_DELETE_KEY)]);
    if (!provided || !safeEqual(providedHash, expectedHash)) {
      // Fallback to Basic Auth for debugging access.
      const access = await requireDebugAccess();
      if (!access.ok) return access.response;
    }

    const before = await getLink(env, host, slug);

    // Delete canonical key + a couple compatibility keys (host without port, and legacy link:{slug})
    await deleteLink(env, host, slug);
    const noPort = host.replace(/:\\d+$/, '');
    if (noPort && noPort !== host) {
      await env.LINKIVERSE.delete(`link:${noPort}:${slug}`);
    }
    await env.LINKIVERSE.delete(`link:${slug}`);

    await writeAudit(env, {
      action: 'link.forceDelete',
      host,
      slug,
      before,
      actor,
    });

    return Response.json({ ok: true, host, slug, existed: Boolean(before) });
  }

  // GET /api/links
  if (pathname === '/api/links' && request.method === 'GET') {
    const links = await getAllLinks(env);
    return Response.json(links);
  }

  // GET /api/audit
  if (pathname === '/api/audit' && request.method === 'GET') {
    const url = new URL(request.url);
    const limit = Math.min(300, Math.max(1, Number(url.searchParams.get('limit') || 100)));
    return Response.json(await listAudit(env, { limit }));
  }

  // GET /api/folders?host=...
  if (pathname === '/api/folders' && request.method === 'GET') {
    const url = new URL(request.url);
    const host = normalizeHost(url.searchParams.get('host'));
    const hostCheck = assertHostAllowed(host);
    if (!hostCheck.ok) return hostCheck.response;
    return Response.json(await listFolders(env, host));
  }

  // POST /api/folders
  if (pathname === '/api/folders' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const host = normalizeHost(body?.host);
    const hostCheck = assertHostAllowed(host);
    if (!hostCheck.ok) return hostCheck.response;

    const slug = body?.slug;
    const name = body?.name;
    const listingEnabled = body?.listingEnabled !== false;
    const password = body?.password ?? null;

    if (!slug || typeof slug !== 'string') return Response.json({ error: 'slug is required' }, { status: 400 });
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(slug)) {
      return Response.json({ error: 'Folder slug may only contain letters, numbers, hyphens and underscores (max 64 chars)' }, { status: 400 });
    }
    if (RESERVED.has(slug.toLowerCase())) return Response.json({ error: `"${slug}" is reserved` }, { status: 400 });

    // Prevent folder slug colliding with an existing link on that host.
    const linkCollision = await getLink(env, host, slug);
    if (linkCollision) return Response.json({ error: `Folder slug "${slug}" collides with an existing link` }, { status: 409 });

    const existingFolder = await getFolder(env, host, slug);
    if (existingFolder) return Response.json({ error: `Folder "${slug}" already exists` }, { status: 409 });

    const folder = {
      slug,
      host,
      name: typeof name === 'string' && name.trim() ? name.trim() : slug,
      listingEnabled: !!listingEnabled,
      passwordHash: password ? await sha256(password) : null,
      createdAt: Date.now(),
    };

    await putFolder(env, host, folder);
    env.ctx?.waitUntil(writeAudit(env, {
      action: 'folder.create',
      host,
      folderSlug: slug,
      after: folder,
      actor,
    }));
    return Response.json({ slug, host, message: 'Created' }, { status: 201 });
  }

  // PATCH /api/folders/:slug
  const patchFolderMatch = pathname.match(/^\/api\/folders\/([^/]+)$/);
  if (patchFolderMatch && request.method === 'PATCH') {
    const folderSlug = decodeURIComponent(patchFolderMatch[1]);
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const host = normalizeHost(body?.host);
    const hostCheck = assertHostAllowed(host);
    if (!hostCheck.ok) return hostCheck.response;

    const existing = await getFolder(env, host, folderSlug);
    if (!existing) return Response.json({ error: 'Folder not found' }, { status: 404 });

    const next = { ...existing };
    if (body?.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) return Response.json({ error: 'name must be a non-empty string' }, { status: 400 });
      next.name = body.name.trim();
    }
    if (body?.listingEnabled !== undefined) next.listingEnabled = !!body.listingEnabled;
    if (body?.password !== undefined) {
      if (body.password === null || body.password === '') next.passwordHash = null;
      else if (typeof body.password === 'string') next.passwordHash = await sha256(body.password);
      else return Response.json({ error: 'password must be a string or null' }, { status: 400 });
    }

    await putFolder(env, host, next);
    env.ctx?.waitUntil(writeAudit(env, {
      action: 'folder.update',
      host,
      folderSlug,
      before: existing,
      after: next,
      actor,
    }));
    return Response.json({ slug: folderSlug, host, message: 'Updated' });
  }

  // DELETE /api/folders/:slug?host=...
  const deleteFolderMatch = pathname.match(/^\/api\/folders\/([^/]+)$/);
  if (deleteFolderMatch && request.method === 'DELETE') {
    const folderSlug = decodeURIComponent(deleteFolderMatch[1]);
    const url = new URL(request.url);
    const host = normalizeHost(url.searchParams.get('host'));
    const hostCheck = assertHostAllowed(host);
    if (!hostCheck.ok) return hostCheck.response;

    const existing = await getFolder(env, host, folderSlug);
    if (!existing) return Response.json({ error: 'Folder not found' }, { status: 404 });

    await deleteFolder(env, host, folderSlug);
    env.ctx?.waitUntil(writeAudit(env, {
      action: 'folder.delete',
      host,
      folderSlug,
      before: existing,
      actor,
    }));
    return Response.json({ message: 'Deleted' });
  }

  // POST /api/links
  if (pathname === '/api/links' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { slug, guest, expiresAt, password, host, folderSlug } = body ?? {};
    const normalizedHost = normalizeHost(host);
    const hostCheck = assertHostAllowed(normalizedHost);
    if (!hostCheck.ok) return hostCheck.response;

    if (!slug || typeof slug !== 'string') {
      return Response.json({ error: 'slug is required' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(slug)) {
      return Response.json(
        { error: 'Slug may only contain letters, numbers, hyphens and underscores (max 64 chars)' },
        { status: 400 },
      );
    }
    if (RESERVED.has(slug.toLowerCase())) {
      return Response.json({ error: `"${slug}" is a reserved slug` }, { status: 400 });
    }
    if (!guest || !isValidUrl(guest)) {
      return Response.json({ error: 'A valid destination URL is required' }, { status: 400 });
    }
    if (expiresAt !== undefined && expiresAt !== null) {
      if (typeof expiresAt !== 'number' || expiresAt < Date.now()) {
        return Response.json({ error: 'expiresAt must be a future Unix timestamp (ms)' }, { status: 400 });
      }
    }

    if (folderSlug !== undefined && folderSlug !== null) {
      if (typeof folderSlug !== 'string') return Response.json({ error: 'folderSlug must be a string or null' }, { status: 400 });
      if (folderSlug && !(await getFolder(env, normalizedHost, folderSlug))) {
        return Response.json({ error: `Folder "${folderSlug}" not found` }, { status: 400 });
      }
    }

    const existing = await getLink(env, normalizedHost, slug);
    if (existing) {
      return Response.json(
        { error: `Slug "${slug}" is already in use on ${normalizedHost}` },
        { status: 409 },
      );
    }

    const passwordHash = password ? await sha256(password) : null;

    const link = {
      slug,
      host: normalizedHost,
      guest,
      passwordHash,
      expiresAt: expiresAt ?? null,
      folderSlug: folderSlug || null,
      clicks: 0,
      createdAt: Date.now(),
      status: 'active',
      inactiveAt: null,
      deletedAt: null,
    };
    await putLink(env, normalizedHost, link);
    env.ctx?.waitUntil(writeAudit(env, {
      action: 'link.create',
      host: normalizedHost,
      slug,
      after: link,
      actor,
    }));
    return Response.json({ slug, host: normalizedHost, message: 'Created' }, { status: 201 });
  }

  // PATCH /api/links/:slug
  const patchMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
  if (patchMatch && request.method === 'PATCH') {
    const slug = decodeURIComponent(patchMatch[1]);
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const normalizedHost = normalizeHost(body?.host);
    const hostCheck = assertHostAllowed(normalizedHost);
    if (!hostCheck.ok) return hostCheck.response;

    const existing = await getLink(env, normalizedHost, slug);
    if (!existing) return Response.json({ error: 'Link not found' }, { status: 404 });

    const next = { ...existing };

    if (body?.status !== undefined) {
      const s = body.status;
      if (s !== 'active' && s !== 'inactive' && s !== 'deleted') {
        return Response.json({ error: 'status must be active, inactive, or deleted' }, { status: 400 });
      }
      next.status = s;
      const purgeMs = 3 * 24 * 60 * 60 * 1000;
      if (s === 'active') {
        next.inactiveAt = null;
        next.deletedAt = null;
        next.purgeAfter = null;
      } else if (s === 'inactive') {
        next.inactiveAt = next.inactiveAt ?? Date.now();
        next.deletedAt = null;
        next.purgeAfter = null;
      } else if (s === 'deleted') {
        next.deletedAt = next.deletedAt ?? Date.now();
        next.purgeAfter = Date.now() + purgeMs;
      }
    }

    if (body?.folderSlug !== undefined) {
      if (body.folderSlug === null || body.folderSlug === '') {
        next.folderSlug = null;
      } else if (typeof body.folderSlug === 'string') {
        const f = await getFolder(env, normalizedHost, body.folderSlug);
        if (!f) return Response.json({ error: `Folder "${body.folderSlug}" not found` }, { status: 400 });
        next.folderSlug = body.folderSlug;
      } else {
        return Response.json({ error: 'folderSlug must be a string or null' }, { status: 400 });
      }
    }

    if (body?.guest !== undefined) {
      if (!body.guest || typeof body.guest !== 'string' || !isValidUrl(body.guest)) {
        return Response.json({ error: 'A valid destination URL is required' }, { status: 400 });
      }
      next.guest = body.guest;
    }

    if (body?.expiresAt !== undefined) {
      if (body.expiresAt === null) {
        next.expiresAt = null;
      } else if (typeof body.expiresAt === 'number' && body.expiresAt >= Date.now()) {
        next.expiresAt = body.expiresAt;
      } else {
        return Response.json({ error: 'expiresAt must be null or a future Unix timestamp (ms)' }, { status: 400 });
      }
    }

    if (body?.password !== undefined) {
      if (body.password === null || body.password === '') {
        next.passwordHash = null;
      } else if (typeof body.password === 'string') {
        next.passwordHash = await sha256(body.password);
      } else {
        return Response.json({ error: 'password must be a string or null' }, { status: 400 });
      }
    }

    await putLink(env, normalizedHost, next);
    env.ctx?.waitUntil(writeAudit(env, {
      action: 'link.update',
      host: normalizedHost,
      slug,
      before: existing,
      after: next,
      actor,
    }));
    return Response.json({ slug: next.slug, host: normalizedHost, message: 'Updated' });
  }

  // POST /api/links/:slug/rename
  const renameMatch = pathname.match(/^\/api\/links\/([^/]+)\/rename$/);
  if (renameMatch && request.method === 'POST') {
    const oldSlug = decodeURIComponent(renameMatch[1]);
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const normalizedHost = normalizeHost(body?.host);
    const hostCheck = assertHostAllowed(normalizedHost);
    if (!hostCheck.ok) return hostCheck.response;

    const newSlug = body?.newSlug;
    if (!newSlug || typeof newSlug !== 'string') {
      return Response.json({ error: 'newSlug is required' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(newSlug)) {
      return Response.json(
        { error: 'Slug may only contain letters, numbers, hyphens and underscores (max 64 chars)' },
        { status: 400 },
      );
    }
    if (RESERVED.has(newSlug.toLowerCase())) {
      return Response.json({ error: `"${newSlug}" is a reserved slug` }, { status: 400 });
    }

    const existing = await getLink(env, normalizedHost, oldSlug);
    if (!existing) return Response.json({ error: 'Link not found' }, { status: 404 });

    const collision = await getLink(env, normalizedHost, newSlug);
    if (collision) return Response.json({ error: `Slug "${newSlug}" is already in use` }, { status: 409 });

    const renamed = { ...existing, slug: newSlug };
    await putLink(env, normalizedHost, renamed);
    await deleteLink(env, normalizedHost, oldSlug);

    env.ctx?.waitUntil(writeAudit(env, {
      action: 'link.rename',
      host: normalizedHost,
      slug: oldSlug,
      newSlug,
      before: existing,
      after: renamed,
      actor,
    }));

    return Response.json({ slug: newSlug, host: normalizedHost, message: 'Renamed' });
  }

  // DELETE /api/links/:slug
  const deleteMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
  if (deleteMatch && request.method === 'DELETE') {
    const slug = decodeURIComponent(deleteMatch[1]);
    const url = new URL(request.url);
    const host = normalizeHost(url.searchParams.get('host'));
    const hostCheck = assertHostAllowed(host);
    if (!hostCheck.ok) return hostCheck.response;

    const existing = await getLink(env, host, slug);
    if (!existing) return Response.json({ error: 'Link not found' }, { status: 404 });
    if ((existing.status ?? 'active') !== 'inactive') {
      return Response.json({ error: 'Link must be inactive before deletion can be scheduled' }, { status: 400 });
    }

    // Always schedule purge for 3 days; no manual hard-delete.
    const next = {
      ...existing,
      status: 'deleted',
      deletedAt: existing.deletedAt ?? Date.now(),
      purgeAfter: Date.now() + 3 * 24 * 60 * 60 * 1000,
    };
    await putLink(env, host, next);
    env.ctx?.waitUntil(writeAudit(env, {
      action: 'link.delete.scheduled',
      host,
      slug,
      before: existing,
      after: next,
      actor,
    }));
    return Response.json({ message: 'Deletion scheduled (3-day retention)' });
  }

  return Response.json({ error: 'API route not found' }, { status: 404 });
}

async function handleRedirect(request, env, slug) {
  const url = new URL(request.url);
  // In Workers/Wrangler dev, Host may be absent; fall back to the URL host.
  const hostHeader = request.headers.get('host');
  const host = normalizeHost(hostHeader ?? url.host);

  const maybeFolder = await getFolder(env, host, slug);
  if (maybeFolder && maybeFolder.listingEnabled !== false) {
    if (maybeFolder.passwordHash) {
      if (request.method === 'POST') {
        let formData;
        try {
          formData = await request.formData();
        } catch {
          return new Response(passwordPage(slug, false), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        const submitted = formData.get('password') ?? '';
        const submittedHash = await sha256(submitted);
        if (!safeEqual(submittedHash, maybeFolder.passwordHash)) {
          return new Response(passwordPage(slug, true), {
            status: 403,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
      } else {
        return new Response(passwordPage(slug, false), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }

    const links = (await listLinksByFolder(env, host, maybeFolder.slug))
      .filter((l) => (l.status ?? 'active') === 'active');

    return new Response(folderListingPage({ origin: url.origin, host, folder: maybeFolder, links }), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  let link = await getLink(env, host, slug);
  let resolvedHost = host;
  if (!link) {
    // Extra defensive lookup: in local dev we sometimes observe key mismatches despite the expected key existing.
    // Try a few host candidates directly against KV before giving up.
    const hostCandidates = [
      host,
      normalizeHost(url.host),
      normalizeHost(hostHeader ?? ''),
    ].filter(Boolean);
    for (const h of hostCandidates) {
      const raw = await env.LINKIVERSE.get(`link:${h}:${slug}`);
      if (!raw) continue;
      try {
        link = JSON.parse(raw);
      } catch {
        link = null;
      }
      if (link) {
        // Migrate to canonical key for future reads
        await putLink(env, h, link);
        resolvedHost = h;
        break;
      }
    }
  }
  if (!link) {
    const headers = { 'Content-Type': 'text/html; charset=utf-8' };
    if ((request.headers.get('x-plummer-debug') ?? '') === '1') {
      headers['X-Plummer-Debug-HostHeader'] = hostHeader ?? '';
      headers['X-Plummer-Debug-UrlHost'] = url.host;
      headers['X-Plummer-Debug-NormalizedHost'] = host;
      headers['X-Plummer-Debug-Key'] = `link:${host}:${slug}`;
    }
    return new Response(notFoundPage(), {
      status: 404,
      headers,
    });
  }

  if (link.status === 'inactive') {
    return new Response(inactivePage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (link.status === 'deleted') {
    return new Response(deletedPage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Check link expiry
  if (link.expiresAt && Date.now() > link.expiresAt) {
    // Clean up the expired link from KV
    await deleteLink(env, resolvedHost, slug);
    return new Response(expiredPage(), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Handle password-protected links
  if (link.passwordHash) {
    if (request.method === 'POST') {
      let formData;
      try {
        formData = await request.formData();
      } catch {
        return new Response(passwordPage(slug, false), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      const submitted = formData.get('password') ?? '';
      const submittedHash = await sha256(submitted);
      if (!safeEqual(submittedHash, link.passwordHash)) {
        return new Response(passwordPage(slug, true), {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      // Correct password — fall through to redirect
    } else {
      return new Response(passwordPage(slug, false), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  // Increment click counter (best-effort; do not block the redirect)
  const updated = { ...link, clicks: (link.clicks ?? 0) + 1 };
  // Use waitUntil if available to avoid delaying the response
  env.ctx?.waitUntil(putLink(env, resolvedHost, updated));

  return Response.redirect(link.guest, 302);
}

export async function routeRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const origin = url.origin;

  // Homepage
  if (pathname === '/' && request.method === 'GET') {
    return handleHomePage(origin);
  }

  // Note: local Basic Auth should NOT be applied to all `/api/*` routes by
  // default. Debug-only endpoints inside `handleAPI()` use `requireDebugAccess()`
  // which enforces Basic Auth when necessary. In production, protect `/admin`
  // at the edge (Cloudflare Access) and leave API access to that protection.

  if ((pathname === '/admin' || pathname === '/admin/') && request.method === 'GET') {
    // By default, `/admin` should be protected at the edge (e.g. Cloudflare Access)
    // in production. To avoid accidental exposure, API routes continue to require
    // Basic Auth via `ADMIN_SECRET`.
    //
    // If you want to enable local Basic Auth instead of an edge-auth solution,
    // uncomment the block below and set `ADMIN_SECRET` (Wrangler secret) and
    // `ENABLE_LOCAL_ADMIN_AUTH=true` in your environment or .dev.vars file.
    /*
    const localAdminEnabled = env.ENABLE_LOCAL_ADMIN_AUTH === true || env.ENABLE_LOCAL_ADMIN_AUTH === 'true';
    if (localAdminEnabled) {
      if (!env.ADMIN_SECRET) {
        return new Response(misconfiguredPage(), {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      const ok = await checkAdminAuth(request, env);
      if (!ok) return unauthorizedResponse();
    }
    */
  }

  // Admin dashboard
  if ((pathname === '/admin' || pathname === '/admin/') && request.method === 'GET') {
    return handleAdminPage(request, env, origin);
  }

  // Heartbeat check endpoint
  if ((pathname === '/heartbeat/check' || pathname === '/heartbeat/check/') && request.method === 'GET') {
    return new Response(heartbeatPage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Heartbeat redirect endpoint (redirects to /heartbeat/check/)
  if ((pathname === '/heartbeat' || pathname === '/heartbeat/') && request.method === 'GET') {
    return Response.redirect(`${origin}/heartbeat/check/`, 301);
  }

  // REST API
  if (pathname.startsWith('/api/')) {
    return handleAPI(request, env, pathname);
  }

  // Short-link redirect — slug must be alphanumeric/-/_
  const slugMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)\/?$/);
  if (slugMatch && (request.method === 'GET' || request.method === 'POST')) {
    return handleRedirect(request, env, slugMatch[1]);
  }

  return new Response(notFoundPage(), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

