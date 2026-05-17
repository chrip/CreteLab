import { i18n } from './i18n.js';

const STORAGE_KEY = 'cretelab_locale';

function createSwitcher() {
  const footer = document.querySelector('footer p');
  if (!footer) return;

  const wrap = document.createElement('span');
  wrap.id = 'langSwitcher';

  const select = document.createElement('select');
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
  });

  wrap.appendChild(select);
  insertBeforeLast(footer, wrap);
}

function insertBeforeLast(parent, child) {
  if (parent.lastChild) parent.insertBefore(child, parent.lastChild);
  else parent.appendChild(child);
}

function rebuildSwitcher() {
  const select = document.querySelector('#langSwitcher select');
  if (select) select.value = i18n.locale;
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
