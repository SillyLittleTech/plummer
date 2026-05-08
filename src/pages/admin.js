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
      const linkHost = link.host ? String(link.host) : new URL(origin).host;
      const shortUrl = `https://${linkHost}/${link.slug}`;
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
              onclick="openEditModal(${escHtml(JSON.stringify(linkHost))}, ${escHtml(JSON.stringify(link.slug))}, ${guestJs}, ${expiresAtJs})"
              title="Edit link">✏️ Edit</button>
            <button class="btn btn-sm btn-secondary"
              onclick="toggleInactive(${escHtml(JSON.stringify(linkHost))}, ${escHtml(JSON.stringify(link.slug))})"
              title="Toggle active/inactive">⏸️</button>
            <button class="btn btn-sm btn-danger"
              onclick="softDeleteLink(${escHtml(JSON.stringify(linkHost))}, ${escHtml(JSON.stringify(link.slug))})"
              title="Delete (soft)">🗑</button>
            <button class="btn btn-sm btn-danger"
              onclick="permanentDeleteLink(${escHtml(JSON.stringify(linkHost))}, ${escHtml(JSON.stringify(link.slug))})"
              title="Delete permanently">💥</button>
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

async function softDeleteLink(host, slug) {
  if (!confirm('Mark ' + host + '/' + slug + ' as deleted? (You can permanently delete after)')) return;
  try {
    await setStatus(host, slug, 'deleted');
    setRowStatus(host, slug, 'deleted');
    showToast('Deleted (soft): ' + host + '/' + slug);
  } catch (e) {
    showToast('Error: ' + (e.message || 'Unknown error'), true);
  }
}

async function permanentDeleteLink(host, slug) {
  if (!confirm('Permanently delete ' + host + '/' + slug + '? This removes it from KV immediately.')) return;
  const r = await fetch(
    '/api/links/' + encodeURIComponent(slug) + '?host=' + encodeURIComponent(host) + '&permanent=1',
    { method: 'DELETE' },
  );
  if (r.ok) {
    showToast('Deleted permanently: ' + host + '/' + slug);
    const row = document.querySelector('[data-slug="' + slug + '"][data-host="' + host + '"]');
    if (row) row.remove();
    const badge = document.getElementById('linkCount');
    if (badge) badge.textContent = parseInt(badge.textContent || '0', 10) - 1;
    const tbody = document.getElementById('linksBody');
    if (tbody && tbody.rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No links yet — create one above!</td></tr>';
    }
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

function openEditModal(host, slug, guest, expiresAt) {
  const backdrop = document.getElementById('editBackdrop');
  backdrop.classList.add('show');
  document.getElementById('editHost').value = host;
  document.getElementById('editOldSlug').value = slug;
  document.getElementById('editSlug').value = slug;
  document.getElementById('editGuest').value = guest || '';
  document.getElementById('editExpiresAt').value = msToDatetimeLocal(expiresAt);
  document.getElementById('editPassword').value = '';
  document.getElementById('editClearPassword').checked = false;
  const err = document.getElementById('editError');
  err.style.display = 'none';
  err.textContent = '';
}

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

    showToast('Updated: https://' + host + '/' + currentSlug);
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
  const expiresAtRaw = fd.get('expiresAt');
  const password = fd.get('password');

  const body = {
    host,
    slug,
    guest,
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

  showToast('Created: https://' + host + '/' + slug);
  e.target.reset();

  // Add row to table
  const tbody = document.getElementById('linksBody');
  // Remove empty-row if present
  const emptyRow = tbody.querySelector('.empty-row');
  if (emptyRow) emptyRow.closest('tr').remove();

  const expiryText = body.expiresAt
    ? new Date(body.expiresAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
  const shortUrl = 'https://' + host + '/' + slug;
  const tr = document.createElement('tr');
  tr.dataset.slug = slug;
  tr.dataset.host = host;
  tr.dataset.status = 'active';

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
      '<button class="btn btn-sm btn-secondary" onclick="openEditModal(' + jsAttr(host) + ', ' + jsAttr(slug) + ', ' + jsAttr(guest) + ', ' + jsAttr(body.expiresAt) + ')" title="Edit link">✏️ Edit</button> ' +
      '<button class="btn btn-sm btn-secondary" onclick="toggleInactive(' + jsAttr(host) + ', ' + jsAttr(slug) + ')" title="Toggle active/inactive">⏸️</button> ' +
      '<button class="btn btn-sm btn-danger" onclick="softDeleteLink(' + jsAttr(host) + ', ' + jsAttr(slug) + ')" title="Delete (soft)">🗑</button> ' +
      '<button class="btn btn-sm btn-danger" onclick="permanentDeleteLink(' + jsAttr(host) + ', ' + jsAttr(slug) + ')" title="Delete permanently">💥</button>' +
    '</td>';
  tbody.insertBefore(tr, tbody.firstChild);

  const badge = document.getElementById('linkCount');
  if (badge) badge.textContent = parseInt(badge.textContent || '0', 10) + 1;
});
    `,
  );
}

