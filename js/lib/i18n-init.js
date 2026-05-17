import { i18n } from './i18n.js';

const STORAGE_KEY = 'cretelab_locale';

function createSwitcher() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;

  // Visual separator
  const sep = document.createElement('span');
  sep.className = 'lang-sep';
  sep.textContent = '·';
  sep.style.cssText = 'color:var(--border-color);padding:8px 2px 8px 12px;user-select:none;';
  nav.appendChild(sep);

  const current = i18n.locale;

  for (const code of ['de', 'en']) {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = code.toUpperCase();
    a.dataset.lang = code;
    a.id = `lang-${code}`;
    if (code === current) a.classList.add('active', 'lang-current');
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const val = a.dataset.lang;
      localStorage.setItem(STORAGE_KEY, val);
      document.documentElement.lang = val;
      await i18n.setLocale(val);
    });
    nav.appendChild(a);
  }
}

function rebuildSwitcher() {
  for (const code of ['de', 'en']) {
    const a = document.getElementById(`lang-${code}`);
    if (!a) continue;
    if (code === i18n.locale) {
      a.classList.add('active', 'lang-current');
    } else {
      a.classList.remove('active', 'lang-current');
    }
  }
}

export async function initI18n() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const detected = i18n.detect();
  const locale = stored || detected;

  document.documentElement.lang = locale;
  await i18n.setLocale(locale, { force: true });
  createSwitcher();

  document.addEventListener('languagechange', rebuildSwitcher);
}

if (import.meta.url.endsWith('.js') || document.readyState !== 'loading') {
  initI18n();
}
