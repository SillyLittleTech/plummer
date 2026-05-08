async function parseJSON(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function normalizeHost(rawHost) {
  // IMPORTANT: keep ports. For local dev we need exact Host header matching (e.g. localhost:8787).
  return String(rawHost ?? '').trim().toLowerCase();
}

function linkKey(host, slug) {
  return `link:${host}:${slug}`;
}

function legacyLinkKey(slug) {
  return `link:${slug}`;
}

function folderKey(host, folderSlug) {
  return `folder:${host}:${folderSlug}`;
}

function folderPrefix(host) {
  return `folder:${host}:`;
}

export async function getFolder(env, host, folderSlug) {
  const h = normalizeHost(host);
  return parseJSON(await env.LINKIVERSE.get(folderKey(h, folderSlug)));
}

export async function putFolder(env, host, folder) {
  const h = normalizeHost(host);
  const f = { ...folder, host: h };
  await env.LINKIVERSE.put(folderKey(h, f.slug), JSON.stringify(f));
}

export async function deleteFolder(env, host, folderSlug) {
  const h = normalizeHost(host);
  await env.LINKIVERSE.delete(folderKey(h, folderSlug));
}

export async function listFolders(env, host) {
  const h = normalizeHost(host);
  const folders = [];
  let cursor;
  do {
    const page = await env.LINKIVERSE.list({ prefix: folderPrefix(h), limit: 100, cursor });
    for (const key of page.keys) {
      const parsed = await parseJSON(await env.LINKIVERSE.get(key.name));
      if (parsed) folders.push(parsed);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  folders.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return folders;
}

export async function listLinksByFolder(env, host, folderSlug) {
  const h = normalizeHost(host);
  const all = await getAllLinks(env);
  return all.filter((l) => normalizeHost(l.host) === h && (l.folderSlug ?? null) === folderSlug);
}

/**
 * Get a link by host+slug.
 * Falls back to legacy key format (`link:{slug}`) and migrates it to host format.
 */
export async function getLink(env, host, slug) {
  const h = normalizeHost(host);
  const raw = await env.LINKIVERSE.get(linkKey(h, slug));
  const parsed = await parseJSON(raw);
  if (parsed) return parsed;

  // Legacy fallback: if found, migrate to host-scoped key.
  const legacyRaw = await env.LINKIVERSE.get(legacyLinkKey(slug));
  const legacyParsed = await parseJSON(legacyRaw);
  if (!legacyParsed) return null;

  const migrated = { ...legacyParsed, host: h };
  await env.LINKIVERSE.put(linkKey(h, slug), JSON.stringify(migrated));
  // Remove legacy key to avoid duplicates in listings once migrated.
  await env.LINKIVERSE.delete(legacyLinkKey(slug));
  return migrated;
}

export async function putLink(env, host, link) {
  const h = normalizeHost(host);
  const withHost = { ...link, host: h };
  await env.LINKIVERSE.put(linkKey(h, withHost.slug), JSON.stringify(withHost));
}

export async function deleteLink(env, host, slug) {
  const h = normalizeHost(host);
  await env.LINKIVERSE.delete(linkKey(h, slug));
}

/** Fetch all stored links (all hosts), handling KV list pagination. */
export async function getAllLinks(env) {
  const links = [];
  let cursor;
  do {
    const page = await env.LINKIVERSE.list({ prefix: 'link:', limit: 100, cursor });
    for (const key of page.keys) {
      const raw = await env.LINKIVERSE.get(key.name);
      const parsed = await parseJSON(raw);
      if (!parsed) continue;

      // Infer host from key if needed (new keys are link:{host}:{slug})
      if (!parsed.host) {
        const parts = key.name.split(':');
        if (parts.length === 3) parsed.host = parts[1];
      }
      links.push(parsed);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  links.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return links;
}

