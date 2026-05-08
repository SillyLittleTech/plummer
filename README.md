# Plummer 🔗

A simple, fast, open-source link shortener powered by **Cloudflare Workers** and **KV**.

Built for [SillyLittleTech](https://sillylittle.tech) at `share.sillylittle.tech`, but designed as a reusable template for anyone who wants to host their own link shortener on Cloudflare's edge network.

---

## Features

| Feature | Details |
|---|---|
| ⚡ Edge-fast redirects | Served from Cloudflare's global network |
| 📊 Click analytics | Per-link click counter in the admin dashboard |
| 🔒 Password protection | Require a password before redirecting |
| ⏰ Link expiry | Set an expiry date/time; expired links are cleaned up automatically |
| 🗂️ Folders | Optional folder pages (e.g. `/referrals/`) that list links |
| 🧾 Audit log | Tracks create/update/delete events with actor IP |
| ♻️ Safe deletes | Links are tombstoned and purged automatically after 3 days |
| 🌙 Dark / light mode | Follows system preference with a manual toggle |
| 🔑 Admin authentication | HTTP Basic Auth secured by a Wrangler secret (defense-in-depth even if you use Cloudflare Access) |

---

## How it works

```
Visitor → share.sillylittle.tech/my-link
        → Cloudflare Worker (nearest edge PoP)
        → KV namespace LINKIVERSE
        → 302 redirect to destination URL
```

Links are stored in a Cloudflare KV namespace as JSON values under a host-scoped key:

- `link:{host}:{slug}` (e.g. `link:share.sillylittle.tech:my-link`)

```jsonc
{
  "host":         "share.sillylittle.tech",
  "slug":         "my-link",
  "guest":        "https://example.com",
  "passwordHash": null,          // SHA-256 of password, or null
  "expiresAt":    null,          // Unix ms timestamp, or null
  "clicks":       42,
  "createdAt":    1714500000000
}
```

---

## Setup

### 1. Fork this repository

Click **Fork** on GitHub and clone your fork locally.

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Cloudflare KV namespace

```bash
# Production namespace
npx wrangler kv namespace create LINKIVERSE

# Development / preview namespace (used by `wrangler dev`)
npx wrangler kv namespace create LINKIVERSE --preview
```

Copy the `id` values printed by the commands above and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding    = "LINKIVERSE"
id         = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

### 4. Admin authentication

Production recommendation: protect the admin dashboard (`/admin`) at the edge (for
example, using Cloudflare Access). All `/api/*` routes always require HTTP Basic
Auth and therefore require `ADMIN_SECRET` to be set.

To enable local Basic Auth instead of an edge solution (for development or if you
don't have an edge auth configured), uncomment the local auth block in
[src/router.js](src/router.js#L752-L792) and set the secret:

```bash
npx wrangler secret put ADMIN_SECRET
# → Enter your chosen password when prompted
```

Then enable the local flag (in `.dev.vars` or your environment):

```
ADMIN_SECRET=your-local-password
ENABLE_LOCAL_ADMIN_AUTH=true
```

When enabled, visiting `/admin` will prompt for Basic Auth (any username + the
password you set). By default the local auth block is commented out in the code
to avoid accidental exposure in production—uncomment it only if you intend to
use local Basic Auth.

### 5. Configure allowed hostnames (multi-domain/subdomain support)

Plummer supports serving and managing links across multiple configured hostnames (domains/subdomains).
Set `ALLOWED_HOSTS_JSON` in `wrangler.toml` as a JSON array of hostnames:

```toml
[vars]
ALLOWED_HOSTS_JSON = "[\"share.sillylittle.tech\",\"links.sillylittle.tech\",\"links.share.sillylittle.tech\"]"
```

The `/admin` UI will show these in a dropdown when creating links.

If you leave `ALLOWED_HOSTS_JSON` unset/empty, API writes are **restricted to the current request host** as a safer default.

### 6. (Optional) Configure a custom domain / route

To use a custom domain (e.g. `share.sillylittle.tech`), uncomment and update the
`[[routes]]` block in `wrangler.toml` and set the correct `zone_id`:

```toml
[[routes]]
pattern = "share.sillylittle.tech/*"
zone_id = "..."
```

The domain must be added to your Cloudflare account and DNS must point to Cloudflare.

### 7. Deploy

```bash
npm run deploy
# or: npx wrangler deploy
```

For local development:

```bash
npm run dev
# or: npx wrangler dev
```

For local dev secrets, you can also use a `.dev.vars` file (Wrangler reads it automatically):

```bash
ADMIN_SECRET=your-local-password
ENABLE_DEBUG_ENDPOINTS=true
FORCE_DELETE_KEY=optional-testing-key
```

---

## GitHub Actions CI/CD

The included workflow (`.github/workflows/deploy.yml`) automatically deploys to
Cloudflare Workers on every push to `main`.

Add the following **repository secrets** in your GitHub repo settings
(**Settings → Secrets and variables → Actions**):

| Secret | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) — create a token with **Workers: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → right-hand sidebar on the Workers overview page |

> **Note:** `ADMIN_SECRET` is stored as a Wrangler secret (step 4 above) and is
> **not** a GitHub Actions secret — Wrangler secrets are separate from GitHub secrets.

---

## Project structure

```
plummer/
├── src/
│   ├── index.js          # Worker entrypoint (fetch + scheduled purge)
│   ├── router.js         # Routing for /admin, /api, redirects, folders, debug endpoints
│   ├── security.js       # Basic auth + response security headers
│   ├── kv.js             # KV storage helpers (host-scoped keys)
│   ├── audit.js          # Audit event storage + listing
│   └── pages/            # HTML pages (home/admin/errors/folders)
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions → Cloudflare Workers
├── wrangler.toml          # Wrangler / Worker configuration
├── package.json
└── README.md
```

---

## API reference

All API routes require HTTP Basic Auth (same credentials as the admin dashboard).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/links` | List all links (JSON array) |
| `POST` | `/api/links` | Create a new link (JSON body) |
| `PATCH` | `/api/links/:slug` | Update a link (destination, expiry, folder, password, status) |
| `POST` | `/api/links/:slug/rename` | Rename a link slug |
| `DELETE` | `/api/links/:slug?host=...` | Schedule deletion (3-day retention) |
| `GET` | `/api/folders?host=...` | List folders for a host |
| `POST` | `/api/folders` | Create folder |
| `PATCH` | `/api/folders/:slug` | Update folder (name, listingEnabled, password) |
| `DELETE` | `/api/folders/:slug?host=...` | Delete folder |
| `GET` | `/api/audit?limit=...` | List recent audit events |

### Debug endpoints (optional)

Debug endpoints are disabled by default. To enable them, set `ENABLE_DEBUG_ENDPOINTS=true`.
Some debug endpoints may additionally require `FORCE_DELETE_KEY`.

### Create link — request body

```jsonc
{
  "slug":      "my-link",          // required — letters, numbers, - and _ only
  "guest":     "https://...",      // required — must be http or https
  "expiresAt": 1714600000000,      // optional — Unix ms timestamp (must be future)
  "password":  "secret123"         // optional — plain text; stored as SHA-256 hash
}
```

---

## License

MIT — see [LICENSE](LICENSE).
