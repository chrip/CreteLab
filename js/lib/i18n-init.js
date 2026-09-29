import { i18n } from './i18n.js';

const STORAGE_KEY = 'cretelab_locale';

/**
 * Detect locale from URL path or stored preference.
 */
function detectLocale() {
  const segments = location.pathname.split('/').filter(Boolean);
  for (const loc of ['de', 'en']) {
    if (segments.includes(loc)) return loc;
  }

  // 2. URL param: ?lang=de
  const urlParams = new URLSearchParams(location.search);
  const paramLang = urlParams.get('lang');
  if (paramLang && ['de', 'en'].includes(paramLang)) return paramLang;

  // 3. Stored locale (from user switch) — but prefer URL if present
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  // 4. Browser language
  return i18n.detect();
}

/**
 * Fix SEO links for locale-prefixed URLs at runtime.
 * Updates <link canonical> and <link alternate> to absolute URLs
 * if the page was served from a locale-prefixed path (/de/ or /en/).
 */
function fixAssetPaths(locale) {
  const url = new URL(location.href);
  const segments = url.pathname.split('/').filter(Boolean);
  const hasRepoPrefix = segments[0] && segments[0].length > 3;
  const prefix = hasRepoPrefix ? `/${segments[0]}` : '';

  // Preserve existing canonical/hreflang from the pre-rendered page
  // — the build already generates them correctly.
}

function createSwitcher() {
  const footer = document.querySelector('footer p');
  if (!footer) return;

  const wrap = document.createElement('span');
  wrap.id = 'langSwitcher';
  wrap.innerHTML = '&nbsp;<select title="' + i18n.t('global.language') + '">\
    <option value="de"' + (i18n.locale === 'de' ? ' selected' : '') + '>DE</option>\
    <option value="en"' + (i18n.locale === 'en' ? ' selected' : '') + '>EN</option>\
  </select>';

  wrap.querySelector('select').addEventListener('change', async () => {
    const val = wrap.querySelector('select').value;
    localStorage.setItem(STORAGE_KEY, val);
    const url = new URL(location.href);
    const segments = url.pathname.split('/').filter(Boolean);
    const locIdx = segments.indexOf(i18n.locale);
    const PAGES = ['index.html', 'fine-tune.html', 'uhpc.html', 'describe.html'];
    const page = segments.at(-1);
    if (locIdx < 0) {
      // No language folder yet (e.g. /fine-tune.html): stay on the same page.
      const base = segments.slice(0, page && PAGES.includes(page) ? -1 : segments.length);
      url.pathname = '/' + [...base, val, ...(page && PAGES.includes(page) ? [page] : [])].join('/');
      location.href = url.toString();
      return;
    }
    const prefix = segments.slice(0, locIdx);
    const parts = [prefix, val];
    if (page && PAGES.includes(page)) parts.push(page);
    url.pathname = '/' + parts.flat().join('/');
    location.href = url.toString();
  });

  footer.appendChild(wrap);
}

function rebuildSwitcher() {
  const select = document.querySelector('#langSwitcher select');
  if (select) select.value = i18n.locale;
}

export async function initI18n() {
  const locale = detectLocale();
  document.documentElement.lang = locale;
  await i18n.setLocale(locale, { force: true });
  fixAssetPaths(locale);
  createSwitcher();
  document.addEventListener('languagechange', rebuildSwitcher);
}

if (import.meta.url.endsWith('.js') || document.readyState !== 'loading') {
  initI18n();
}
