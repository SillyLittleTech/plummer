import { htmlPage } from './shared.js';
import { escHtml } from '../util.js';

export function folderListingPage({ origin, host, folder, links }) {
  const title = folder?.name ? `${folder.name} — Plummer` : 'Folder — Plummer';
  const safeName = folder?.name ? escHtml(folder.name) : escHtml(folder?.slug ?? 'Folder');
  const base = new URL(origin);
  base.host = host;

  const rows = links.length === 0
    ? `<tr><td colspan="4" class="empty-row">No links in this folder yet.</td></tr>`
    : links.map((link) => {
      const shortUrl = `${base.origin}/${link.slug}`;
      const expiry = link.expiresAt
        ? new Date(link.expiresAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      const status = link.status || 'active';
      return `<tr>
        <td><a href="${escHtml(shortUrl)}"><code>${escHtml(link.slug)}</code></a></td>
        <td class="url-cell"><a href="${escHtml(link.guest)}" target="_blank" rel="noopener">${escHtml(link.guest)}</a></td>
        <td class="center">${escHtml(status)}</td>
        <td class="center nowrap">${escHtml(expiry)}</td>
      </tr>`;
    }).join('');

  return htmlPage(
    title,
    `<div class="wrap">
  <header class="header">
    <a href="/" class="back-link">← Home</a>
    <h1>${safeName}</h1>
    <p class="sub">Folder listing on <code>${escHtml(host)}</code></p>
  </header>

  <section class="card">
    <h2>Links</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Destination</th>
            <th class="center">Status</th>
            <th class="center">Expires</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </section>
</div>`,
    `
    body { padding: 24px 16px 40px; }
    .wrap { max-width: 960px; margin: 0 auto; }
    .header { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border-color); }
    .header h1 { font-size: 1.8rem; font-weight: 900; margin: 8px 0 4px; }
    .sub { opacity: 0.75; font-size: 0.95rem; }
    .sub code { font-family: ui-monospace, monospace; background: var(--card-hover); padding: 1px 6px; border-radius: 4px; }
    .back-link { color: var(--accent-color); font-weight: 700; font-size: 0.9rem; }
    .back-link:hover { text-decoration: underline; }

    h2 { font-size: 1.05rem; font-weight: 800; margin-bottom: 12px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead { background: var(--card-hover); }
    th {
      padding: 10px 14px; text-align: left;
      font-size: 11px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.6px; white-space: nowrap;
    }
    td { padding: 12px 14px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .center { text-align: center; }
    .nowrap { white-space: nowrap; }
    .url-cell { max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty-row { text-align: center; padding: 28px; opacity: 0.6; font-style: italic; }
    code { font-family: ui-monospace, "Cascadia Code", monospace; }
    `,
  );
}

