import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = dirname(scriptDir);
const activePath = resolve(root, 'wrangler.toml');
const devPath = resolve(root, 'wrangler.toml.local.bac');
const prodPath = resolve(root, 'wrangler.toml.cloud.bac');

const mode = (process.argv[2] || 'toggle').toLowerCase();

const active = readFileSync(activePath, 'utf8');
const dev = readFileSync(devPath, 'utf8');
const prod = readFileSync(prodPath, 'utf8');

let next;

if (mode === 'dev') {
  next = dev;
} else if (mode === 'prod') {
  next = prod;
} else if (active === dev) {
  next = prod;
} else if (active === prod) {
  next = dev;
} else {
  console.error('wrangler.toml does not match either backup. Use `npm run toml:dev` or `npm run toml:prod`.');
  process.exit(1);
}

writeFileSync(activePath, next);

const label = next === dev ? 'dev' : 'prod';
console.log(`Updated wrangler.toml -> ${label}`);
