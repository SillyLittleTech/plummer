import { normalizeHost } from './kv.js';

function padTs(ts) {
  // 13-digit ms timestamp, lexicographically sortable
  return String(ts).padStart(13, '0');
}

function auditKey(ts, id) {
  return `audit:${padTs(ts)}:${id}`;
}

function randomId() {
  // short, URL-safe
  return Math.random().toString(36).slice(2, 10);
}

export function getActor(request) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    null;
  const ua = request.headers.get('user-agent') || null;
  const ray = request.headers.get('cf-ray') || null;
  return { ip, ua, ray };
}

export async function writeAudit(env, event) {
  const ts = event.timestamp ?? Date.now();
  const id = event.id ?? randomId();
  const key = auditKey(ts, id);
  const payload = { ...event, timestamp: ts, id };
  if (payload.host) payload.host = normalizeHost(payload.host);
  await env.LINKIVERSE.put(key, JSON.stringify(payload));
  return { key, id, timestamp: ts };
}

export async function listAudit(env, { limit = 100 } = {}) {
  const items = [];
  let cursor;
  do {
    const page = await env.LINKIVERSE.list({ prefix: 'audit:', limit: 100, cursor });
    for (const key of page.keys) {
      const raw = await env.LINKIVERSE.get(key.name);
      if (!raw) continue;
      try {
        items.push(JSON.parse(raw));
      } catch {
        // ignore
      }
      if (items.length >= limit) break;
    }
    if (items.length >= limit) break;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  items.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return items.slice(0, limit);
}

