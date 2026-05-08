import { htmlPage } from './shared.js';
import { escHtml } from '../util.js';

export function adminPage(links, origin, allowedHosts = []) {
  const hosts = Array.isArray(allowedHosts) && allowedHosts.length > 0
    ? allowedHosts
    : [new URL(origin).host];

  const rows = links.length === 0
    ? `<tr><td colspan="6" class="empty-row">No links yet — create one above!</td></tr>`
    : links.map((link) => {
      const expiry = link.expiresAt
        ? new Date(link.expiresAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      const currentOrigin = new URL(origin);
      const currentHost = currentOrigin.host;
      const linkHost = link.host ? String(link.host) : currentHost;
      const shortUrl = (linkHost === currentHost)
        ? `${origin}/${link.slug}`
        : `https://${linkHost}/${link.slug}`;
      const guestJs = escHtml(JSON.stringify(link.guest ?? ''));
      const expiresAtJs = escHtml(JSON.stringify(link.expiresAt ?? null));
      const status = link.status || 'active';
      const statusBadge =
        status === 'active' ? '<span class="pill pill-ok">Active</span>' :
        status === 'inactive' ? '<span class="pill pill-warn">Inactive</span>' :
        '<span class="pill pill-danger">Deleted</span>';

      return `<tr data-slug="${escHtml(link.slug)}" data-host="${escHtml(linkHost)}" data-status="${escHtml(status)}">
          <td><code class="slug-code">${escHtml(link.slug)}</code></td>
          <td class="host-cell"><code class="host-code">${escHtml(linkHost)}</code></td>
          <td class="center status-cell">${statusBadge}</td>
          <td class="url-cell">
            <a href="${escHtml(link.guest)}" target="_blank" rel="noopener"
               title="${escHtml(link.guest)}">${escHtml(link.guest)}</a>
          </td>
          <td class="center">${link.clicks ?? 0}</td>
          <td class="center">${link.passwordHash ? '🔒' : '—'}</td>
          <td class="center nowrap">${expiry}</td>
          <td class="center nowrap">
            <button class="btn btn-sm btn-secondary"
              onclick="copyLink(${escHtml(JSON.stringify(shortUrl))})"
              title="Copy short URL">📋 Copy</button>
            <button class="btn btn-sm btn-secondary"
              onclick="openEditModal(${escHtml(JSON.stringify(linkHost))}, ${escHtml(JSON.stringify(link.slug))}, ${guestJs}, ${expiresAtJs}, ${escHtml(JSON.stringify(link.folderSlug ?? null))})"
              title="Edit link">✏️ Edit</button>
            <button class="btn btn-sm btn-secondary"
              onclick="toggleInactive(${escHtml(JSON.stringify(linkHost))}, ${escHtml(JSON.stringify(link.slug))})"
              title="Toggle active/inactive">⏸️</button>
            <button class="btn btn-sm btn-danger" data-action="schedule-delete"
              style="${status === 'inactive' ? '' : 'display:none;'}"
              onclick="scheduleDeleteLink(${escHtml(JSON.stringify(linkHost))}, ${escHtml(JSON.stringify(link.slug))})"
              title="Schedule deletion (3 days)">🗑 Delete</button>
          </td>
        </tr>`;
    }).join('');

  return htmlPage(
    'Plummer — Admin',
    `<div class="admin-wrap">
  <header class="admin-header">
    <a href="/" class="back-link">← Plummer</a>
    <h1>Link Dashboard</h1>
    <p>Create, track, and manage your short links.</p>
  </header>

  <section class="card create-card" aria-label="Create short link">
    <h2>Create Short Link</h2>
    <form id="createForm" novalidate>
      <div class="form-row">
        <div class="form-group">
          <label for="host">Domain</label>
          <select class="select" id="host" name="host" required>
            ${hosts.map((h) => `<option value="${escHtml(h)}">${escHtml(h)}</option>`).join('')}
          </select>
          <p class="hint">Choose which configured domain/subdomain this link belongs to.</p>
        </div>
        <div class="form-group">
          <label for="folderSlug">Folder <span class="opt">(optional)</span></label>
          <select class="select" id="folderSlug" name="folderSlug">
            <option value="">— None —</option>
          </select>
          <p class="hint">Folders create reserved directory URLs (e.g. /referals/).</p>
        </div>
        <div class="form-group">
          <label for="slug">Slug</label>
          <input class="input" type="text" id="slug" name="slug"
            placeholder="my-link" pattern="[a-zA-Z0-9_-]+" required
            autocomplete="off" spellcheck="false" />
          <p class="hint">Letters, numbers, hyphens and underscores only.</p>
        </div>
        <div class="form-group">
          <label for="guest">Destination URL</label>
          <input class="input" type="url" id="guest" name="guest"
            placeholder="https://example.com" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="expiresAt">Expires at <span class="opt">(optional)</span></label>
          <input class="input" type="datetime-local" id="expiresAt" name="expiresAt" />
          <p class="hint">Leave blank for a permanent link.</p>
        </div>
        <div class="form-group">
          <label for="password">Password protection <span class="opt">(optional)</span></label>
          <input class="input" type="password" id="password" name="password"
            placeholder="Leave blank for none" autocomplete="new-password" />
          <p class="hint">Visitors must enter this before being redirected.</p>
        </div>
      </div>
      <div id="formError" class="alert alert-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary" id="createBtn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Create Link
      </button>
    </form>
  </section>

  <section class="card links-card" aria-label="All short links">
    <h2>All Links <span class="badge" id="linkCount">${links.length}</span></h2>
    <div style="margin:-6px 0 12px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
      <label style="display:flex; align-items:center; gap:10px; font-weight:700; font-size:13px; opacity:0.9;">
        <input type="checkbox" id="showDeletedToggle" />
        Show deleted (last 3 days)
      </label>
      <span class="hint" style="margin:0;">Deleted links purge automatically after 3 days.</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Domain</th>
            <th class="center">Status</th>
            <th>Destination</th>
            <th class="center">Clicks</th>
            <th class="center">Pass</th>
            <th class="center">Expires</th>
            <th class="center">Actions</th>
          </tr>
        </thead>
        <tbody id="linksBody">
          ${rows}
        </tbody>
      </table>
    </div>
  </section>

  <section class="card folders-card" aria-label="Folders">
    <div class="folder-head">
      <h2 style="margin:0;">Folders</h2>
      <button class="btn btn-sm btn-secondary" id="newFolderBtn" type="button" title="Create folder">＋</button>
    </div>
    <div class="form-group" style="margin-top:12px;">
      <label for="folderHost">Domain</label>
      <select class="select" id="folderHost" name="host" required>
        ${hosts.map((h) => `<option value="${escHtml(h)}">${escHtml(h)}</option>`).join('')}
      </select>
      <p class="hint">Folders are per-domain. The active folder filters the link table.</p>
    </div>

    <nav id="folderList" class="folder-list" aria-label="Folder list">
      <button class="folder-item is-active" type="button" data-folder="">
        <span class="folder-dot"></span>
        <span class="folder-name">Default</span>
      </button>
      <div class="folder-divider"></div>
      <div class="folder-empty">Loading…</div>
    </nav>
  </section>

  <section class="card audit-card" aria-label="Audit log">
    <h2>Audit</h2>
    <p class="hint" style="margin-top:-10px; margin-bottom:12px;">Recent create/modify/delete events with actor IP.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Host</th>
            <th>Target</th>
            <th class="center">IP</th>
          </tr>
        </thead>
        <tbody id="auditBody">
          <tr><td colspan="5" class="empty-row">Loading audit…</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</div>

<div id="editBackdrop" class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit link">
  <div class="modal">
    <div class="modal-header">
      <h3>Edit link</h3>
      <button class="btn btn-sm btn-link" id="editCancelBtn" type="button">Close</button>
    </div>
    <div class="modal-body">
      <form id="editForm" novalidate>
        <input type="hidden" id="editHost" />
        <input type="hidden" id="editOldSlug" />

        <div class="form-row">
          <div class="form-group">
            <label for="editSlug">Slug</label>
            <input class="input" type="text" id="editSlug" name="slug"
              pattern="[a-zA-Z0-9_-]+" required autocomplete="off" spellcheck="false" />
            <p class="hint">Renaming changes the short URL.</p>
          </div>
          <div class="form-group">
            <label for="editExpiresAt">Expires at <span class="opt">(optional)</span></label>
            <input class="input" type="datetime-local" id="editExpiresAt" name="expiresAt" />
            <p class="hint">Leave blank for a permanent link.</p>
          </div>
        </div>

        <div class="form-group">
          <label for="editGuest">Destination URL</label>
          <input class="input" type="url" id="editGuest" name="guest" required />
        </div>

        <div class="form-group">
          <label for="editFolderSlug">Folder <span class="opt">(optional)</span></label>
          <select class="select" id="editFolderSlug" name="folderSlug">
            <option value="">— None —</option>
          </select>
          <p class="hint">Assign this link to a folder directory URL.</p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="editPassword">Set new password <span class="opt">(optional)</span></label>
            <input class="input" type="password" id="editPassword" name="password"
              placeholder="Leave blank to keep unchanged" autocomplete="new-password" />
            <p class="hint">If set, visitors must enter this before redirecting.</p>
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <label style="display:flex; align-items:center; gap:10px; font-weight:600;">
              <input type="checkbox" id="editClearPassword" />
              Clear password protection
            </label>
            <p class="hint">Removes the password requirement for this link.</p>
          </div>
        </div>

        <div id="editError" class="alert alert-error" style="display:none;"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="editCancelBtn2" type="button">Cancel</button>
          <button class="btn btn-primary" id="editSaveBtn" type="submit">Save changes</button>
        </div>
      </form>
    </div>
  </div>
</div>

<div id="folderBackdrop" class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create folder" style="display:none;">
  <div class="modal">
    <div class="modal-header">
      <h3>Create folder</h3>
      <button class="btn btn-sm btn-link" id="folderCancelBtn" type="button">Close</button>
    </div>
    <div class="modal-body">
      <form id="folderModalForm" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="folderHostCreate">Domain</label>
            <select class="select" id="folderHostCreate" name="host" required>
              ${hosts.map((h) => `<option value="${escHtml(h)}">${escHtml(h)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="folderSlugCreate">Folder slug</label>
            <input class="input" type="text" id="folderSlugCreate" name="slug"
              placeholder="referrals" pattern="[a-zA-Z0-9_-]+" required autocomplete="off" spellcheck="false" />
            <p class="hint">Becomes a reserved path like <code>/{slug}/</code>.</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="folderNameCreate">Name</label>
            <input class="input" type="text" id="folderNameCreate" name="name" placeholder="Referrals" />
          </div>
          <div class="form-group">
            <label for="folderPasswordCreate">Password <span class="opt">(optional)</span></label>
            <input class="input" type="password" id="folderPasswordCreate" name="password"
              placeholder="Leave blank for none" autocomplete="new-password" />
            <p class="hint">If set, visitors must enter it to view the folder listing.</p>
          </div>
        </div>
        <label style="display:flex; align-items:center; gap:10px; font-weight:700; font-size:13px; opacity:0.9;">
          <input type="checkbox" id="folderListingEnabledCreate" checked />
          Listing enabled
        </label>
        <div id="folderFormError" class="alert alert-error" style="display:none; margin-top:12px;"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="folderCancelBtn2" type="button">Cancel</button>
          <button class="btn btn-primary" type="submit">Create folder</button>
        </div>
      </form>
    </div>
  </div>
</div>

<div id="toast" class="toast" role="status" aria-live="polite"></div>`,

    /* extra CSS */
    `
    body { padding: 24px 16px 40px; }
    .admin-wrap { max-width: 1060px; margin: 0 auto; }
    .admin-header {
      margin-bottom: 24px; padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .admin-header h1 { font-size: 2rem; font-weight: 800; margin: 8px 0 4px; }
    .admin-header p { opacity: 0.7; font-size: 0.95rem; }
    .back-link { color: var(--accent-color); font-weight: 600; font-size: 0.875rem; }
    .back-link:hover { text-decoration: underline; }

    .create-card { margin-bottom: 20px; }
    .create-card h2, .links-card h2 {
      font-size: 1.1rem; font-weight: 700; margin-bottom: 18px;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .opt { font-weight: 400; opacity: 0.6; font-size: 12px; }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead { background: var(--card-hover); }
    th {
      padding: 10px 14px; text-align: left;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.6px; white-space: nowrap;
    }
    td { padding: 12px 14px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: color-mix(in srgb, var(--card-hover) 50%, transparent); }
    .center { text-align: center; }
    .nowrap { white-space: nowrap; }
    .slug-code {
      font-family: ui-monospace, "Cascadia Code", monospace;
      background: var(--card-hover); padding: 2px 8px;
      border-radius: 5px; font-size: 13px;
    }
    .host-code {
      font-family: ui-monospace, "Cascadia Code", monospace;
      background: var(--card-hover); padding: 2px 8px;
      border-radius: 5px; font-size: 12px;
      opacity: 0.9;
    }
    .url-cell {
      max-width: 260px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .url-cell a { font-size: 13px; }
    .empty-row { text-align: center; padding: 40px; opacity: 0.55; font-style: italic; }
    .badge {
      background: var(--accent-color); color: #fff;
      border-radius: 999px; padding: 2px 9px;
      font-size: 11px; font-weight: 700; margin-left: 8px;
      vertical-align: middle;
    }
    #formError { margin-top: 12px; margin-bottom: 0; }
    .actions-cell { display: flex; gap: 6px; justify-content: center; }
    td:last-child { text-align: center; }
    td:last-child .btn { margin: 2px; }

    .folders-card { margin-bottom: 20px; }
    .folder-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .folder-list { display:flex; flex-direction:column; gap:6px; margin-top: 10px; }
    .folder-item {
      display:flex; align-items:center; gap:10px;
      width: 100%;
      text-align:left;
      padding: 10px 10px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-weight: 700;
      font-size: 13px;
      opacity: 0.92;
    }
    .folder-item:hover { background: color-mix(in srgb, var(--card-hover) 70%, transparent); }
    .folder-item.is-active {
      background: color-mix(in srgb, var(--accent-color) 12%, transparent);
      border-color: color-mix(in srgb, var(--accent-color) 40%, var(--border-color));
    }
    .folder-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--accent-color); opacity: 0.9; }
    .folder-name { flex: 1; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
    .folder-meta { font-weight: 600; opacity: 0.65; font-size: 12px; }
    .folder-divider { height: 1px; background: var(--border-color); opacity: 0.7; margin: 6px 0; }
    .folder-empty { padding: 12px 10px; opacity: 0.65; font-style: italic; }

    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.2px;
      border: 1px solid var(--border-color);
    }
    .pill-ok { background: color-mix(in srgb, var(--success-color) 18%, transparent); color: var(--success-color); }
    .pill-warn { background: color-mix(in srgb, #f59e0b 16%, transparent); color: #f59e0b; }
    .pill-danger { background: color-mix(in srgb, var(--danger-color) 16%, transparent); color: var(--danger-color); }

    /* Edit modal */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: none;
      align-items: center; justify-content: center;
      padding: 16px;
      z-index: 9998;
    }
    .modal-backdrop.show { display: flex; }
    .modal {
      width: 100%;
      max-width: 640px;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      box-shadow: 0 24px 70px rgba(0,0,0,0.25);
      overflow: hidden;
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px;
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
    }
    .modal-header h3 { font-size: 1rem; margin: 0; }
    .modal-body { padding: 16px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 8px; }
    .btn-link { background: transparent; border: 1px solid var(--border-color); }

    @media (max-width: 640px) {
      .form-row { grid-template-columns: 1fr; }
      body { padding: 16px 12px 40px; }
    }
    `,

    /* extra script */
    `
const ORIGIN = ${JSON.stringify(origin)};
const HOSTS = ${JSON.stringify(hosts)};

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (isError ? 'toast-error' : 'toast-ok');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); }, 2800);
}

// (deleteLink removed in favor of softDeleteLink/permanentDeleteLink)

async function setStatus(host, slug, status) {
  const r = await fetch('/api/links/' + encodeURIComponent(slug), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, status }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Status update failed');
  return d;
}

function setRowStatus(host, slug, status) {
  const row = document.querySelector('[data-slug="' + slug + '"][data-host="' + host + '"]');
  if (!row) return;
  row.dataset.status = status;
  const statusCell = row.querySelector('.status-cell');
  if (!statusCell) return;
  statusCell.innerHTML =
    status === 'active' ? '<span class="pill pill-ok">Active</span>' :
    status === 'inactive' ? '<span class="pill pill-warn">Inactive</span>' :
    '<span class="pill pill-danger">Deleted</span>';

  // Ensure delete button visibility matches status rules
  const delBtn = row.querySelector('[data-action=\"schedule-delete\"]');
  if (delBtn) delBtn.style.display = status === 'inactive' ? '' : 'none';
}

let SHOW_DELETED = false;
let ACTIVE_FOLDER = '';
let ACTIVE_FOLDER_NAME = 'Default';
let ACTIVE_HOST = '';
let LAST_FOLDERS = [];

function applyRowVisibility() {
  const hostSel = document.getElementById('host');
  if (hostSel) ACTIVE_HOST = hostSel.value;

  const rows = document.querySelectorAll('#linksBody tr[data-status]');
  for (const row of rows) {
    const s = row.dataset.status || 'active';
    const host = row.dataset.host || '';
    const folder = row.dataset.folderSlug || '';

    const hostOk = !ACTIVE_HOST || host === ACTIVE_HOST;
    const folderOk = folder === (ACTIVE_FOLDER || '');
    const deletedOk = !(s === 'deleted' && !SHOW_DELETED);
    row.style.display = hostOk && folderOk && deletedOk ? '' : 'none';
  }
}

async function toggleInactive(host, slug) {
  const row = document.querySelector('[data-slug="' + slug + '"][data-host="' + host + '"]');
  const current = row ? (row.dataset.status || 'active') : 'active';
  const next = current === 'inactive' ? 'active' : 'inactive';
  try {
    await setStatus(host, slug, next);
    setRowStatus(host, slug, next);
    showToast((next === 'active' ? 'Activated: ' : 'Inactivated: ') + host + '/' + slug);
  } catch (e) {
    showToast('Error: ' + (e.message || 'Unknown error'), true);
  }
}

async function scheduleDeleteLink(host, slug) {
  if (!confirm('Schedule deletion for ' + host + '/' + slug + '? It will be removed automatically after 3 days.')) return;
  const r = await fetch('/api/links/' + encodeURIComponent(slug) + '?host=' + encodeURIComponent(host), {
    method: 'DELETE',
  });
  if (r.ok) {
    showToast('Deletion scheduled: ' + host + '/' + slug);
    setRowStatus(host, slug, 'deleted');
    applyRowVisibility();
  } else {
    const d = await r.json().catch(() => ({}));
    showToast('Error: ' + (d.error || 'Unknown error'), true);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url)
    .then(() => showToast('Copied: ' + url))
    .catch(() => showToast('Could not copy to clipboard.', true));
}

async function fetchFolders(host) {
  const r = await fetch('/api/folders?host=' + encodeURIComponent(host));
  if (!r.ok) return [];
  return await r.json().catch(() => ([]));
}

function renderFolderOptions(selectEl, folders) {
  selectEl.innerHTML = '<option value=\"\">— None —</option>' +
    folders.map((f) => '<option value=\"' + String(f.slug).replace(/\"/g,'&quot;') + '\">' + String(f.name || f.slug).replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</option>').join('');
}

function renderFolderSidebar(folders) {
  const list = document.getElementById('folderList');
  if (!list) return;

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
  }

  const items = (folders || []).map((f) => {
    const name = f.name || f.slug;
    const metaBits = [];
    if (f.listingEnabled === false) metaBits.push('listing off');
    if (f.passwordHash) metaBits.push('🔒');
    const meta = metaBits.length ? ('<span class=\"folder-meta\">' + esc(metaBits.join(' • ')) + '</span>') : '';
    const activeClass = (String(f.slug) === String(ACTIVE_FOLDER)) ? ' is-active' : '';
    return (
      '<button class=\"folder-item' + activeClass + '\" type=\"button\" data-folder=\"' + esc(f.slug) + '\" data-folder-name=\"' + esc(name) + '\">' +
        '<span class=\"folder-dot\"></span>' +
        '<span class=\"folder-name\">' + esc(name) + '</span>' +
        meta +
      '</button>'
    );
  }).join('');

  const defaultActive = (ACTIVE_FOLDER || '') === '' ? ' is-active' : '';
  const empty = (folders && folders.length) ? '' : '<div class=\"folder-empty\">No folders yet.</div>';

  list.innerHTML =
    '<button class=\"folder-item' + defaultActive + '\" type=\"button\" data-folder=\"\" data-folder-name=\"Default\">' +
      '<span class=\"folder-dot\"></span>' +
      '<span class=\"folder-name\">Default</span>' +
    '</button>' +
    '<div class=\"folder-divider\"></div>' +
    (items || empty);

  list.querySelectorAll('.folder-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.getAttribute('data-folder') || '';
      const name = btn.getAttribute('data-folder-name') || (slug ? slug : 'Default');
      setActiveFolder(slug, name);
    });
  });
}

async function refreshFoldersForHost(host) {
  const folders = await fetchFolders(host);
  LAST_FOLDERS = folders;
  renderFolderOptions(document.getElementById('folderSlug'), folders);
  renderFolderOptions(document.getElementById('editFolderSlug'), folders);
  restoreActiveFolderForHost(host);
  renderFolderSidebar(folders);
}

async function deleteFolder(host, slug) {
  if (!confirm('Delete folder ' + host + '/' + slug + '?')) return;
  const r = await fetch('/api/folders/' + encodeURIComponent(slug) + '?host=' + encodeURIComponent(host), { method: 'DELETE' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return showToast('Error: ' + (d.error || 'Unknown error'), true);
  showToast('Folder deleted: ' + slug);
  await refreshFoldersForHost(host);
}

function restoreActiveFolderForHost(host) {
  const key = 'plummer.activeFolder:' + host;
  const saved = localStorage.getItem(key);
  if (saved === null) return;
  try {
    const parsed = JSON.parse(saved);
    setActiveFolder(parsed.slug || '', parsed.name || (parsed.slug ? parsed.slug : 'Default'), { persist: false });
  } catch {
    // ignore
  }
}

function setActiveFolder(folderSlug, folderName, opts) {
  ACTIVE_FOLDER = folderSlug || '';
  ACTIVE_FOLDER_NAME = folderName || (ACTIVE_FOLDER ? ACTIVE_FOLDER : 'Default');
  const host = document.getElementById('host')?.value || '';
  const persist = !(opts && opts.persist === false);
  if (persist && host) {
    localStorage.setItem('plummer.activeFolder:' + host, JSON.stringify({ slug: ACTIVE_FOLDER, name: ACTIVE_FOLDER_NAME }));
  }
  const sel = document.getElementById('folderSlug');
  if (sel) sel.value = ACTIVE_FOLDER;
  renderFolderSidebar(LAST_FOLDERS);
  applyRowVisibility();
}

async function fetchAudit(limit) {
  const r = await fetch('/api/audit?limit=' + encodeURIComponent(limit || 100));
  if (!r.ok) return [];
  return await r.json().catch(() => ([]));
}

function renderAuditTable(items) {
  const tbody = document.getElementById('auditBody');
  if (!tbody) return;
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan=\"5\" class=\"empty-row\">No audit events yet.</td></tr>';
    return;
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
  }

  tbody.innerHTML = items.map((e) => {
    const ts = e.timestamp ? new Date(e.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' }) : '—';
    const action = e.action || '—';
    const host = e.host || '—';
    const target = e.slug ? ('/' + e.slug) : (e.folderSlug ? ('folder:' + e.folderSlug) : '—');
    const ip = e.actor && e.actor.ip ? e.actor.ip : '—';
    return '<tr>' +
      '<td class=\"nowrap\">' + esc(ts) + '</td>' +
      '<td>' + esc(action) + '</td>' +
      '<td><code class=\"host-code\">' + esc(host) + '</code></td>' +
      '<td><code>' + esc(target) + '</code></td>' +
      '<td class=\"center nowrap\">' + esc(ip) + '</td>' +
    '</tr>';
  }).join('');
}

async function refreshAudit() {
  const items = await fetchAudit(150);
  renderAuditTable(items);
}

document.getElementById('host').addEventListener('change', async (e) => {
  const host = e.target.value;
  // keep folder host selector in sync by default
  const fh = document.getElementById('folderHost');
  if (fh && fh.value !== host && HOSTS.includes(host)) fh.value = host;
  await refreshFoldersForHost(host);
});

document.getElementById('folderHost').addEventListener('change', async (e) => {
  await refreshFoldersForHost(e.target.value);
});

function openFolderModal() {
  const backdrop = document.getElementById('folderBackdrop');
  if (!backdrop) return;
  const host = document.getElementById('folderHost')?.value || document.getElementById('host')?.value || '';
  const hostCreate = document.getElementById('folderHostCreate');
  if (hostCreate && host) hostCreate.value = host;
  backdrop.style.display = '';
  setTimeout(() => document.getElementById('folderSlugCreate')?.focus(), 0);
}

function closeFolderModal() {
  const backdrop = document.getElementById('folderBackdrop');
  if (!backdrop) return;
  backdrop.style.display = 'none';
  const errEl = document.getElementById('folderFormError');
  if (errEl) errEl.style.display = 'none';
}

document.getElementById('newFolderBtn')?.addEventListener('click', openFolderModal);
document.getElementById('folderCancelBtn')?.addEventListener('click', closeFolderModal);
document.getElementById('folderCancelBtn2')?.addEventListener('click', closeFolderModal);

document.getElementById('folderModalForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const errEl = document.getElementById('folderFormError');
  errEl.style.display = 'none';
  const host = document.getElementById('folderHostCreate').value.trim();
  const slug = document.getElementById('folderSlugCreate').value.trim();
  const name = document.getElementById('folderNameCreate').value.trim();
  const password = document.getElementById('folderPasswordCreate').value;
  const listingEnabled = document.getElementById('folderListingEnabledCreate').checked;

  const r = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, slug, name, password: password || null, listingEnabled }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    errEl.textContent = d.error || 'Failed to create folder.';
    errEl.style.display = '';
    return;
  }
  showToast('Folder created: ' + slug);
  document.getElementById('folderSlugCreate').value = '';
  document.getElementById('folderNameCreate').value = '';
  document.getElementById('folderPasswordCreate').value = '';
  document.getElementById('folderListingEnabledCreate').checked = true;
  await refreshFoldersForHost(host);
  closeFolderModal();
});

// --- Edit modal helpers ---
function isoToDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function msToDatetimeLocal(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function closeEditModal() {
  const backdrop = document.getElementById('editBackdrop');
  backdrop.classList.remove('show');
}

function openEditModal(host, slug, guest, expiresAt, folderSlug) {
  const backdrop = document.getElementById('editBackdrop');
  backdrop.classList.add('show');
  document.getElementById('editHost').value = host;
  document.getElementById('editOldSlug').value = slug;
  document.getElementById('editSlug').value = slug;
  document.getElementById('editGuest').value = guest || '';
  document.getElementById('editExpiresAt').value = msToDatetimeLocal(expiresAt);
  document.getElementById('editFolderSlug').value = folderSlug || '';
  document.getElementById('editPassword').value = '';
  document.getElementById('editClearPassword').checked = false;
  const err = document.getElementById('editError');
  err.style.display = 'none';
  err.textContent = '';
}

document.getElementById('showDeletedToggle').addEventListener('change', (e) => {
  SHOW_DELETED = !!e.target.checked;
  applyRowVisibility();
});

// Initial hide of deleted rows
document.addEventListener('DOMContentLoaded', () => {
  refreshFoldersForHost(document.getElementById('host').value);
  refreshAudit();
  applyRowVisibility();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeEditModal();
});

document.getElementById('editBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'editBackdrop') closeEditModal();
});

document.getElementById('editCancelBtn').addEventListener('click', (e) => {
  e.preventDefault();
  closeEditModal();
});

document.getElementById('editCancelBtn2').addEventListener('click', (e) => {
  e.preventDefault();
  closeEditModal();
});

document.getElementById('editForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const errEl = document.getElementById('editError');
  errEl.style.display = 'none';

  const host = document.getElementById('editHost').value.trim();
  const oldSlug = document.getElementById('editOldSlug').value.trim();
  const newSlug = document.getElementById('editSlug').value.trim();
  const guest = document.getElementById('editGuest').value.trim();
  const expiresAtRaw = document.getElementById('editExpiresAt').value;
  const folderSlug = document.getElementById('editFolderSlug').value.trim();
  const password = document.getElementById('editPassword').value;
  const clearPassword = document.getElementById('editClearPassword').checked;

  const saveBtn = document.getElementById('editSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    let currentSlug = oldSlug;

    if (newSlug && newSlug !== oldSlug) {
      const rr = await fetch('/api/links/' + encodeURIComponent(oldSlug) + '/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, newSlug }),
      });
      const rd = await rr.json().catch(() => ({}));
      if (!rr.ok) throw new Error(rd.error || 'Rename failed');
      currentSlug = rd.slug || newSlug;

      // Update table row dataset/slug display
      const row = document.querySelector('[data-slug="' + oldSlug + '"][data-host="' + host + '"]');
      if (row) {
        row.dataset.slug = currentSlug;
        const code = row.querySelector('.slug-code');
        if (code) code.textContent = currentSlug;
      }
      document.getElementById('editOldSlug').value = currentSlug;
    }

    const patchBody = {
      host,
      guest,
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw).getTime() : null,
    };
    patchBody.folderSlug = folderSlug || null;
    if (clearPassword) patchBody.password = null;
    else if (password) patchBody.password = password;

    const pr = await fetch('/api/links/' + encodeURIComponent(currentSlug), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    });
    const pd = await pr.json().catch(() => ({}));
    if (!pr.ok) throw new Error(pd.error || 'Update failed');

    // Update destination cell + expiry cell + pass cell
    const row = document.querySelector('[data-slug="' + currentSlug + '"][data-host="' + host + '"]');
    if (row) {
      const destCell = row.querySelector('.url-cell a');
      if (destCell) {
        destCell.href = guest;
        destCell.title = guest;
        destCell.textContent = guest;
      }
      const expiryCell = row.querySelector('td.center.nowrap');
      if (expiryCell) {
        expiryCell.textContent = expiresAtRaw
          ? new Date(new Date(expiresAtRaw).getTime()).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
          : '—';
      }
      const passCell = row.querySelectorAll('td.center')[3];
      if (passCell) {
        // If user entered a password, show lock. If cleared, show dash. Otherwise unchanged.
        if (clearPassword) passCell.textContent = '—';
        else if (password) passCell.textContent = '🔒';
      }
    }

    showToast('Updated: ' + (host === new URL(ORIGIN).host ? (ORIGIN + '/' + currentSlug) : ('https://' + host + '/' + currentSlug)));
    closeEditModal();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to update link.';
    errEl.style.display = '';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save changes';
  }
});

document.getElementById('createForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const errEl = document.getElementById('formError');
  errEl.style.display = 'none';
  const fd = new FormData(e.target);
  const host = fd.get('host').trim();
  const slug = fd.get('slug').trim();
  const guest = fd.get('guest').trim();
  const folderSlug = (fd.get('folderSlug') || '').trim();
  const expiresAtRaw = fd.get('expiresAt');
  const password = fd.get('password');

  const body = {
    host,
    slug,
    guest,
    folderSlug: folderSlug || null,
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw).getTime() : null,
    password: password || null,
  };

  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  const r = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  btn.disabled = false;
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Link';

  if (!r.ok) {
    errEl.textContent = d.error || 'Failed to create link.';
    errEl.style.display = '';
    return;
  }

  showToast('Created: ' + (host === new URL(ORIGIN).host ? (ORIGIN + '/' + slug) : ('https://' + host + '/' + slug)));
  e.target.reset();

  // Add row to table
  const tbody = document.getElementById('linksBody');
  // Remove empty-row if present
  const emptyRow = tbody.querySelector('.empty-row');
  if (emptyRow) emptyRow.closest('tr').remove();

  const expiryText = body.expiresAt
    ? new Date(body.expiresAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
  const shortUrl = (host === new URL(ORIGIN).host) ? (ORIGIN + '/' + slug) : ('https://' + host + '/' + slug);
  const tr = document.createElement('tr');
  tr.dataset.slug = slug;
  tr.dataset.host = host;
  tr.dataset.status = 'active';
  tr.dataset.folderSlug = folderSlug || '';

  // Use JSON.stringify to get a safe JS literal, then HTML-encode the quotes
  // for the onclick attribute value (browser decodes HTML entities before eval).
  function jsAttr(val) {
    return JSON.stringify(val).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  }
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  tr.innerHTML =
    '<td><code class="slug-code">' + esc(slug) + '</code></td>' +
    '<td><code class="host-code">' + esc(host) + '</code></td>' +
    '<td class="center status-cell"><span class="pill pill-ok">Active</span></td>' +
    '<td class="url-cell"><a href="' + esc(guest) + '" target="_blank" rel="noopener" title="' + esc(guest) + '">' + esc(guest) + '</a></td>' +
    '<td class="center">0</td>' +
    '<td class="center">' + (body.password ? '🔒' : '—') + '</td>' +
    '<td class="center nowrap">' + esc(expiryText) + '</td>' +
    '<td class="center nowrap">' +
      '<button class="btn btn-sm btn-secondary" onclick="copyLink(' + jsAttr(shortUrl) + ')" title="Copy short URL">📋 Copy</button> ' +
      '<button class="btn btn-sm btn-secondary" onclick="openEditModal(' + jsAttr(host) + ', ' + jsAttr(slug) + ', ' + jsAttr(guest) + ', ' + jsAttr(body.expiresAt) + ', ' + jsAttr(folderSlug || null) + ')" title="Edit link">✏️ Edit</button> ' +
      '<button class="btn btn-sm btn-secondary" onclick="toggleInactive(' + jsAttr(host) + ', ' + jsAttr(slug) + ')" title="Toggle active/inactive">⏸️</button> ' +
      '' +
    '</td>';
  tbody.insertBefore(tr, tbody.firstChild);

  const badge = document.getElementById('linkCount');
  if (badge) badge.textContent = parseInt(badge.textContent || '0', 10) + 1;
  applyRowVisibility();
});
    `,
  );
}

