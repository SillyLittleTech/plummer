import { RESERVED } from './constants.js';
import { isValidUrl } from './util.js';

const VAR_RE = /\$\{([1-3])\}/g;
const ANY_VAR_RE = /\$\{([^}]+)\}/g;
const STATIC_SEGMENT_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function normalizePattern(raw) {
  return String(raw ?? '').trim().replace(/^\/+|\/+$/g, '');
}

function uniqueVars(raw) {
  return [...new Set([...String(raw ?? '').matchAll(VAR_RE)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

function hasMalformedVars(raw) {
  const text = String(raw ?? '');
  const allowed = [...text.matchAll(VAR_RE)].map((m) => m[0]);
  const all = [...text.matchAll(ANY_VAR_RE)].map((m) => m[0]);
  return all.some((v) => !allowed.includes(v));
}

function validateSequential(vars) {
  if (vars.length === 0) return false;
  for (let i = 0; i < vars.length; i++) {
    if (vars[i] !== i + 1) return false;
  }
  return true;
}

function varsAreSubset(values, allowed) {
  return values.every((v) => allowed.includes(v));
}

export function validateTransformerInput(sourcePattern, targetTemplate) {
  const pattern = normalizePattern(sourcePattern);
  const target = String(targetTemplate ?? '').trim();
  if (!pattern) return { ok: false, error: 'Transformer source pattern is required' };
  if (!target) return { ok: false, error: 'Transformer target template is required' };
  if (hasMalformedVars(pattern) || hasMalformedVars(target)) {
    return { ok: false, error: 'Transformer variables must use ${1}, ${2}, or ${3}' };
  }

  const sourceVars = uniqueVars(pattern);
  const targetVars = uniqueVars(target);
  if (!validateSequential(sourceVars)) {
    return { ok: false, error: 'Transformer source must include ${1} and may continue with ${2} and ${3}' };
  }
  if (targetVars.length === 0) {
    return { ok: false, error: 'Transformer target must use at least one matched variable' };
  }
  if (!varsAreSubset(targetVars, sourceVars)) {
    return { ok: false, error: 'Transformer target can only use variables present in the source pattern' };
  }

  const segments = pattern.split('/');
  if (RESERVED.has(segments[0].toLowerCase())) {
    return { ok: false, error: `"${segments[0]}" is reserved` };
  }

  for (const segment of segments) {
    if (/^\$\{[1-3]\}$/.test(segment)) {
      continue;
    }
    if (segment.includes('${')) {
      return { ok: false, error: 'Variables in the source pattern must be full path segments' };
    }
    if (!STATIC_SEGMENT_RE.test(segment)) {
      return { ok: false, error: 'Transformer path segments may only contain letters, numbers, hyphens, underscores, or ${n}' };
    }
  }

  const sampleValues = { 1: 'sample-one', 2: 'sample-two', 3: 'sample-three' };
  const sampleTarget = applyTemplate(target, sampleValues);
  if (!isValidUrl(sampleTarget)) {
    return { ok: false, error: 'Transformer target must resolve to a valid http(s) URL' };
  }

  return { ok: true, sourcePattern: pattern, targetTemplate: target };
}

export function matchTransformer(transformer, pathname) {
  if (!transformer || transformer.status === 'inactive' || transformer.status === 'deleted') return null;
  const pattern = normalizePattern(transformer.sourcePattern);
  const path = normalizePattern(pathname);
  if (!pattern || !path) return null;

  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');
  if (patternSegments.length !== pathSegments.length) return null;
  if (/^\$\{[1-3]\}$/.test(patternSegments[0]) && RESERVED.has(pathSegments[0].toLowerCase())) {
    return null;
  }

  const values = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const part = patternSegments[i];
    const varMatch = part.match(/^\$\{([1-3])\}$/);
    if (varMatch) {
      try {
        values[varMatch[1]] = decodeURIComponent(pathSegments[i]);
      } catch {
        return null;
      }
      continue;
    }
    if (part !== pathSegments[i]) return null;
  }

  const target = applyTemplate(transformer.targetTemplate, values);
  if (!isValidUrl(target)) return null;
  return { transformer, target, values };
}

export function applyTemplate(template, values) {
  return String(template ?? '').replace(VAR_RE, (_match, n) => encodeURIComponent(values[n] ?? ''));
}
