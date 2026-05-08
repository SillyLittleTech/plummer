import { htmlPage } from './shared.js';
import { escHtml } from '../util.js';

export function passwordPage(slug, badPassword) {
  return htmlPage(
    'Protected Link — Plummer',
    `<div class="pw-wrap">
  <div class="card pw-card">
    <div class="pw-icon" aria-hidden="true">🔒</div>
    <h1>Protected Link</h1>
    <p>This link requires a password. Enter it below to continue.</p>
    ${badPassword ? '<div class="alert alert-error">Incorrect password — please try again.</div>' : ''}
    <form method="POST" action="/${escHtml(slug)}">
      <div class="form-group">
        <label for="password">Password</label>
        <input class="input" type="password" id="password" name="password"
          required autofocus autocomplete="current-password" />
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;">
        Continue →
      </button>
    </form>
  </div>
</div>`,
    `
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .pw-wrap { width:100%; max-width:380px; }
    .pw-card { text-align:center; }
    .pw-icon { font-size:3rem; margin-bottom:18px; }
    h1 { font-size:1.5rem; font-weight:800; margin-bottom:10px; }
    p { opacity:0.72; margin-bottom:20px; font-size:0.95rem; }
    .alert { text-align:left; }
    `,
  );
}

export function expiredPage() {
  return htmlPage(
    'Link Expired — Plummer',
    `<div class="center-wrap">
  <div class="card center-card">
    <div class="page-icon" aria-hidden="true">⏰</div>
    <h1>Link Expired</h1>
    <p>This short link has expired and is no longer active.</p>
    <a href="/" class="btn btn-secondary" style="margin-top:1.25rem;">← Back to Home</a>
  </div>
</div>`,
    `
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .center-card { text-align:center; max-width:380px; }
    .page-icon { font-size:3rem; margin-bottom:18px; }
    h1 { font-size:1.5rem; font-weight:800; margin-bottom:10px; }
    p { opacity:0.72; margin-bottom:4px; font-size:0.95rem; }
    `,
  );
}

export function inactivePage() {
  return htmlPage(
    'Link Inactive — Plummer',
    `<div class="center-wrap">
  <div class="card center-card">
    <div class="page-icon" aria-hidden="true">⏸️</div>
    <h1>Link Inactive</h1>
    <p>This short link is currently inactive.</p>
    <a href="/" class="btn btn-secondary" style="margin-top:1.25rem;">← Back to Home</a>
  </div>
</div>`,
    `
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .center-card { text-align:center; max-width:380px; }
    .page-icon { font-size:3rem; margin-bottom:18px; }
    h1 { font-size:1.5rem; font-weight:800; margin-bottom:10px; }
    p { opacity:0.72; margin-bottom:4px; font-size:0.95rem; }
    `,
  );
}

export function deletedPage() {
  return htmlPage(
    'Link Deleted — Plummer',
    `<div class="center-wrap">
  <div class="card center-card">
    <div class="page-icon" aria-hidden="true">🗑</div>
    <h1>Link Deleted</h1>
    <p>This short link has been deleted.</p>
    <a href="/" class="btn btn-secondary" style="margin-top:1.25rem;">← Back to Home</a>
  </div>
</div>`,
    `
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .center-card { text-align:center; max-width:380px; }
    .page-icon { font-size:3rem; margin-bottom:18px; }
    h1 { font-size:1.5rem; font-weight:800; margin-bottom:10px; }
    p { opacity:0.72; margin-bottom:4px; font-size:0.95rem; }
    `,
  );
}

export function notFoundPage() {
  return htmlPage(
    'Not Found — Plummer',
    `<div class="center-wrap">
  <div class="card center-card">
    <div class="page-icon" aria-hidden="true">🔍</div>
    <h1>Link Not Found</h1>
    <p>This short link doesn't exist, or may have been deleted.</p>
    <a href="/" class="btn btn-secondary" style="margin-top:1.25rem;">← Back to Home</a>
  </div>
</div>`,
    `
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .center-card { text-align:center; max-width:380px; }
    .page-icon { font-size:3rem; margin-bottom:18px; }
    h1 { font-size:1.5rem; font-weight:800; margin-bottom:10px; }
    p { opacity:0.72; margin-bottom:4px; font-size:0.95rem; }
    `,
  );
}

export function misconfiguredPage() {
  return htmlPage(
    'Setup Required — Plummer',
    `<div class="center-wrap">
  <div class="card center-card">
    <div class="page-icon" aria-hidden="true">⚙️</div>
    <h1>Setup Required</h1>
    <p>The <code>ADMIN_SECRET</code> environment variable is not configured.</p>
    <p style="margin-top:10px;">
      Run the following command to set it, then re-deploy:
    </p>
    <pre class="setup-code">npx wrangler secret put ADMIN_SECRET</pre>
    <a href="https://github.com/SillyLittleTech/plummer#setup" target="_blank"
       rel="noopener" class="btn btn-primary" style="margin-top:1.25rem;">
      View Setup Guide →
    </a>
  </div>
</div>`,
    `
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .center-card { text-align:center; max-width:440px; }
    .page-icon { font-size:3rem; margin-bottom:18px; }
    h1 { font-size:1.5rem; font-weight:800; margin-bottom:10px; }
    p { opacity:0.75; margin-bottom:4px; font-size:0.95rem; }
    p code {
      font-family: ui-monospace, monospace;
      background: var(--card-hover); padding: 1px 6px; border-radius: 4px; font-size:0.9rem;
    }
    .setup-code {
      margin-top:14px; padding:12px 16px;
      background:var(--card-hover); border:1px solid var(--border-color);
      border-radius:8px; font-family:ui-monospace,monospace; font-size:13px;
      text-align:left; overflow-x:auto;
    }
    `,
  );
}

