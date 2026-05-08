// Shared HTML/CSS primitives used by all pages.

// ─── Shared CSS (based on SillyLittleTech lander / pasCurtain) ──────────────
const SHARED_CSS = `
  :root {
    --bg-color: #ffffff;
    --text-color: #1a1a1a;
    --card-bg: #f5f5f5;
    --card-hover: #e8e8e8;
    --border-color: #e0e0e0;
    --shadow: rgba(0,0,0,0.1);
    --accent-color: #667eea;
    --danger-color: #ef4444;
    --success-color: #10b981;
  }
  [data-theme="dark"] {
    --bg-color: #1a1a1a;
    --text-color: #ffffff;
    --card-bg: #2d2d2d;
    --card-hover: #3a3a3a;
    --border-color: #404040;
    --shadow: rgba(0,0,0,0.3);
    --accent-color: #8b9dff;
    --danger-color: #f87171;
    --success-color: #34d399;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI",
      Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    background: var(--bg-color);
    color: var(--text-color);
    transition: background-color 0.18s ease, color 0.18s ease;
    min-height: 100vh;
    line-height: 1.6;
  }
  a { color: var(--accent-color); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 6px;
    padding: 10px 18px;
    border: none; border-radius: 10px;
    font-family: inherit; font-size: 15px; font-weight: 700;
    cursor: pointer;
    transition: transform 0.14s ease, box-shadow 0.14s ease, opacity 0.12s ease;
    text-decoration: none;
    white-space: nowrap;
  }
  .btn:hover { text-decoration: none; }
  .btn-primary {
    background: linear-gradient(180deg, var(--accent-color),
      color-mix(in srgb, var(--accent-color) 85%, black 15%));
    color: #fff;
    box-shadow: 0 6px 24px rgba(102,126,234,0.2);
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 32px rgba(102,126,234,0.25);
  }
  .btn-secondary {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    color: var(--text-color);
  }
  .btn-secondary:hover { background: var(--card-hover); transform: translateY(-2px); }
  .btn-danger { background: var(--danger-color); color: #fff; }
  .btn-danger:hover { opacity: 0.9; transform: translateY(-1px); }
  .btn-sm { padding: 6px 12px; font-size: 13px; border-radius: 8px; }

  /* Cards */
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 16px var(--shadow);
  }

  /* Form elements */
  .input, .select {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-color);
    color: var(--text-color);
    font-family: inherit; font-size: 15px;
    transition: border-color 0.14s ease;
  }
  .input:focus, .select:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 20%, transparent);
  }
  label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
  .form-group { margin-bottom: 16px; }
  .hint { font-size: 12px; opacity: 0.65; margin-top: 4px; }

  /* Theme toggle */
  .theme-toggle {
    position: fixed; top: 20px; right: 20px;
    background: var(--card-bg);
    border: 2px solid var(--border-color); border-radius: 50%;
    width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 1000;
    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  }
  .theme-toggle:hover { background: var(--card-hover); transform: rotate(12deg); }
  .theme-toggle svg {
    width: 22px; height: 22px;
    color: var(--text-color);
    fill: none; stroke: currentColor;
    stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  }
  .sun-icon { display: none; }
  .moon-icon { display: block; }
  [data-theme="dark"] .sun-icon { display: block; }
  [data-theme="dark"] .moon-icon { display: none; }

  /* Alerts */
  .alert {
    padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;
    font-weight: 600; font-size: 14px;
  }
  .alert-error {
    background: color-mix(in srgb, var(--danger-color) 10%, transparent);
    border: 1px solid var(--danger-color); color: var(--danger-color);
  }
  .alert-success {
    background: color-mix(in srgb, var(--success-color) 10%, transparent);
    border: 1px solid var(--success-color); color: var(--success-color);
  }

  /* Toast notification */
  .toast {
    position: fixed; bottom: 24px; right: 24px;
    background: var(--card-bg); border: 1px solid var(--border-color);
    border-radius: 10px; padding: 12px 20px;
    font-weight: 600; font-size: 14px;
    box-shadow: 0 8px 32px var(--shadow);
    transform: translateY(80px); opacity: 0;
    transition: all 0.3s ease; z-index: 9999;
    max-width: 320px;
  }
  .toast.show { transform: translateY(0); opacity: 1; }
  .toast.toast-error { border-color: var(--danger-color); }
  .toast.toast-ok { border-color: var(--success-color); }
`;

// ─── Theme toggle script ─────────────────────────────────────────────────────
const THEME_SCRIPT = `
(function(){
  var html = document.documentElement;
  function getSaved(){ try{ return localStorage.getItem('theme'); }catch(e){ return null; } }
  function save(t){ try{ localStorage.setItem('theme',t); }catch(e){} }
  function apply(t){ if(t) html.dataset.theme = t; }
  function detect(){
    try{ return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    catch(e){ return 'light'; }
  }
  function toggle(){
    var c = html.dataset.theme||'light';
    var n = c==='light' ? 'dark' : 'light';
    apply(n); save(n);
  }
  var saved = getSaved();
  var theme = saved || detect();
  apply(theme);
  if(!saved) save(theme);
  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('themeToggle');
    if(btn) btn.addEventListener('click', toggle);
  });
})();
`;

const TOGGLE_BTN = `<button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">
  <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
  <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
</button>`;

// ─── HTML page wrapper ───────────────────────────────────────────────────────
export function htmlPage(title, bodyContent, extraCss = '', extraScript = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script>(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap" />
  <style>${SHARED_CSS}${extraCss}</style>
</head>
<body>
  ${TOGGLE_BTN}
  ${bodyContent}
  <script>${THEME_SCRIPT}${extraScript}</script>
</body>
</html>`;
}

