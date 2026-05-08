import { APP_VERSION } from '../constants.js';
import { htmlPage } from './shared.js';

export function homePage(origin) {
  return htmlPage(
    'Plummer — Link Shortener',
    `<main class="home-main">
  <div class="hero">
    <div class="hero-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="1.5"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    </div>
    <h1>Plummer</h1>
    <p class="tagline">A simple, fast link shortener — powered by<br>Cloudflare Workers &amp; KV.</p>
    <a href="/admin" class="btn btn-primary hero-cta">Manage Links →</a>
  </div>

  <div class="features">
    <div class="feature-card card">
      <div class="feature-icon" aria-hidden="true">⚡</div>
      <h3>Edge-Fast Redirects</h3>
      <p>Every redirect is served from Cloudflare's global edge network — sub-millisecond latency worldwide.</p>
    </div>
    <div class="feature-card card">
      <div class="feature-icon" aria-hidden="true">📊</div>
      <h3>Click Analytics</h3>
      <p>Track how many times each short link has been visited, right from the admin dashboard.</p>
    </div>
    <div class="feature-card card">
      <div class="feature-icon" aria-hidden="true">🔒</div>
      <h3>Password Protection</h3>
      <p>Optionally require a password before visitors are redirected — perfect for private links.</p>
    </div>
    <div class="feature-card card">
      <div class="feature-icon" aria-hidden="true">⏰</div>
      <h3>Link Expiry</h3>
      <p>Set links to expire automatically at a specific date and time. Expired links are cleaned up automatically.</p>
    </div>
  </div>
</main>

<footer class="home-footer">
  Plummer <span class="app-version">${APP_VERSION}</span> — Open-source link shortener by
  <a href="https://sillylittle.tech" target="_blank" rel="noopener">SillyLittleTech</a>.
  <a href="https://github.com/SillyLittleTech/plummer" target="_blank" rel="noopener">View on GitHub</a>
</footer>`,
    /* extra CSS */
    `
    body {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 20px 80px;
    }
    .home-main { max-width: 900px; width: 100%; }

    /* Hero */
    .hero { text-align: center; padding: 60px 20px 48px; }
    .hero-icon {
      width: 84px; height: 84px;
      background: linear-gradient(135deg, var(--accent-color),
        color-mix(in srgb, var(--accent-color) 70%, #8b5cf6 30%));
      border-radius: 20px;
      display: inline-flex; align-items: center; justify-content: center;
      color: #fff; margin-bottom: 28px;
      box-shadow: 0 8px 32px color-mix(in srgb, var(--accent-color) 40%, transparent);
    }
    h1 { font-size: 3.5rem; font-weight: 800; letter-spacing: -2px; line-height: 1; }
    .tagline {
      font-size: 1.15rem; opacity: 0.75; margin-top: 16px;
      max-width: 420px; margin-left: auto; margin-right: auto;
      line-height: 1.7;
    }
    .hero-cta { margin-top: 28px; font-size: 1rem; padding: 12px 28px; border-radius: 12px; }

    /* Features */
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px; margin-top: 16px;
    }
    .feature-card { text-align: center; }
    .feature-icon { font-size: 2rem; margin-bottom: 12px; }
    .feature-card h3 { font-size: 1rem; font-weight: 700; margin-bottom: 8px; }
    .feature-card p { font-size: 0.875rem; opacity: 0.7; line-height: 1.55; }

    /* Footer */
    .home-footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      text-align: center; padding: 10px 16px;
      background: var(--card-bg); border-top: 1px solid var(--border-color);
      font-size: 0.82rem; opacity: 0.8;
    }
    .app-version { font-weight: 700; opacity: 0.75; }

    @media (max-width: 600px) {
      h1 { font-size: 2.4rem; }
      .features { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 400px) {
      .features { grid-template-columns: 1fr; }
    }
    `,
  );
}

