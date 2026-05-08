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
import { deletedPage, expiredPage, inactivePage, notFoundPage, passwordPage } from './pages/errors.js';
import { folderListingPage } from './pages/folders.js';
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

  function assertHostAllowed(host) {
    if (!host) return { ok: false, response: Response.json({ error: 'host is required' }, { status: 400 }) };
    if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
      return {
        ok: false,
        response: Response.json({ error: `"${host}" is not an allowed host` }, { status: 400 }),
      };
    }
    return { ok: true };
  }

  // GET /api/debug/link?host=...&slug=...
  // Temporary debugging helper for KV key issues in dev.
  if (pathname === '/api/debug/link' && request.method === 'GET') {
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
      if (s === 'inactive') next.inactiveAt = next.inactiveAt ?? Date.now();
      if (s === 'active') next.inactiveAt = null;
      if (s === 'deleted') next.deletedAt = next.deletedAt ?? Date.now();
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

    return new Response(folderListingPage({ host, folder: maybeFolder, links }), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const link = await getLink(env, host, slug);
  if (!link) {
    return new Response(notFoundPage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
    await deleteLink(env, host, slug);
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
  env.ctx?.waitUntil(putLink(env, host, updated));

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

  // Admin dashboard
  if ((pathname === '/admin' || pathname === '/admin/') && request.method === 'GET') {
    return handleAdminPage(request, env, origin);
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

