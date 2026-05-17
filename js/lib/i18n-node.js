// i18n-node.js — Minimal i18n module for Node.js (no DOM dependency).
// Used by build scripts to translate HTML templates at build time.
//
// Usage:
//   import { i18n } from './i18n-node.js';
//   i18n.setLocale('en');
//   i18n.t('index.label.volume');  // → "Required volume (m³):"

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', '..', 'locales');

/** @type {Record<string, Record<string, string>>} */
const catalogues = { de: null, en: null };
let _locale = 'de';

/** @type {Record<string, Record<string, string>>} */
const cache = {};

function getCatalogue(locale) {
  if (catalogues[locale]) return catalogues[locale];
  const path = cache[locale] || join(LOCALES_DIR, `${locale}.json`);
  try {
    catalogues[locale] = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // Fall back to embedded default if file not found
    catalogues[locale] = {};
  }
  return catalogues[locale];
}

/** Look up a key in the catalogue. Returns null if not found. */
function lookup(cat, key) {
  if (!cat || !key) return null;
  return cat[key] ?? null;
}

/** Resolve a single key with cascading fallbacks. */
function resolve(key) {
  const cat = getCatalogue(_locale);

  // Direct match
  let msg = lookup(cat, key);

  // Underscore → dot
  if (msg === null) {
    const dotKey = key.replace(/_/g, '.');
    if (dotKey !== key) {
      msg = lookup(cat, dotKey);
    }
  }

  // Cascade: try progressively shorter prefixes
  if (msg === null) {
    const parts = key.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      msg = lookup(cat, parts.slice(0, i).join('.'));
      if (msg) break;
    }
  }

  // Ultimate fallback: return the raw key
  if (msg === null) return key;

  // Variable substitution
  // (This simple version expects keys to be called directly)
  return msg;
}

export const i18n = {
  get locale() { return _locale; },

  /** Set the active locale. */
  async setLocale(locale) {
    _locale = locale;
    return this;
  },

  /** Translate a key, with optional variable substitutions. */
  t(key, vars) {
    let msg = resolve(key);
    if (!vars) return msg;
    return msg.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  },
};
