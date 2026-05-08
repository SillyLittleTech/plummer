import { normalizeHost } from './kv.js';

function padTs(ts) {
  // 13-digit ms timestamp, lexicographically sortable
  return String(ts).padStart(13, '0');
}

function auditKey(ts, id) {
  return `audit:${padTs(ts)}:${id}`;
}

function randomId() {
  // short, URL-safe (avoid Math.random predictability/collisions)
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } catch {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
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
  const keysWindow = [];
  const windowSize = Math.max(200, Math.min(1000, limit * 5));
  let cursor;
  do {
    const page = await env.LINKIVERSE.list({ prefix: 'audit:', limit: 100, cursor });
    for (const key of page.keys) {
      keysWindow.push(key.name);
      if (keysWindow.length > windowSize) keysWindow.shift();
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const items = [];
  for (const name of keysWindow) {
    const raw = await env.LINKIVERSE.get(name);
    if (!raw) continue;
    try {
      items.push(JSON.parse(raw));
    } catch {
      // ignore
    }
  }

  items.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return items.slice(0, limit);
}

