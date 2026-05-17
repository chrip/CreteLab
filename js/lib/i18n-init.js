import { i18n } from './i18n.js';

const STORAGE_KEY = 'cretelab_locale';

function createSwitcher() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;

  const select = document.createElement('select');
  select.id = 'langSwitcher';
  select.title = i18n.t('global.language');

  for (const code of ['de', 'en']) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code.toUpperCase();
    if (code === i18n.locale) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', async () => {
    const val = select.value;
    localStorage.setItem(STORAGE_KEY, val);
    document.documentElement.lang = val;
    await i18n.setLocale(val);
    select.value = val;
  });

  nav.appendChild(select);
}

function rebuildSwitcher() {
  const select = document.getElementById('langSwitcher');
  if (!select) return;
  select.value = i18n.locale;
}

export async function initI18n() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const detected = i18n.detect();
  const locale = stored || detected;

  document.documentElement.lang = locale;
  await i18n.setLocale(locale);
  createSwitcher();

  document.addEventListener('languagechange', rebuildSwitcher);
}

if (import.meta.url.endsWith('.js') || document.readyState !== 'loading') {
  initI18n();
}
