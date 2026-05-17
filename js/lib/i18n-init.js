import { i18n } from './i18n.js';

const STORAGE_KEY = 'cretelab_locale';

/**
 * Detect locale from URL path (/de/ or /en/), URL param (?lang=),
 * stored preference, or browser language.
 * Also rewrites the current URL to include the locale prefix
 * so bookmarks and direct links stay consistent.
 */
function detectLocale() {
  // 1. URL path: /de/ or /en/
  const pathMatch = location.pathname.match(/^\/(de|en)\//);
  if (pathMatch) return pathMatch[1];

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
 * Fix relative page links for locale-prefixed URLs.
 * The build uses relative links like href="fine-tune/" which already resolve
 * correctly. This function adds absolute URLs for the <link> SEO tags
 * (canonical, hreflang) which must be absolute per spec.
 */
function fixAssetPaths(locale) {
  const url = new URL(location.href);
  const segments = url.pathname.split('/').filter(Boolean);
  const hasRepoPrefix = segments[0] && segments[0].length > 3;
  const prefix = hasRepoPrefix ? `/${segments[0]}` : '';
  const localePrefix = `${prefix}/${locale}`;

  // Update active nav state based on current page
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href === '.' || href === '' || (href === '../' && segments.at(-1) === '')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  }

  // Fix canonical links to be absolute
  for (const canonical of document.querySelectorAll('link[rel="canonical"]')) {
    canonical.setAttribute('href', `${url.origin}${prefix}/${locale}/`);
  }

  // Fix hreflang links
  for (const link of document.querySelectorAll('link[rel="alternate"]')) {
    const hreflang = link.getAttribute('hreflang');
    if (hreflang && hreflang !== locale) {
      link.setAttribute('href', `${url.origin}${prefix}/${hreflang}/`);
    }
  }
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
    const repoName = segments.find(s => s.length > 3);
    const base = repoName ? `/${repoName}` : '';
    const page = segments.at(-1);
    if (page && ['index.html', 'fine-tune.html', 'uhpc.html'].includes(page)) {
      url.pathname = `${base}/${val}/${page}`;
    } else {
      url.pathname = `${base}/${val}/`;
    }
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
