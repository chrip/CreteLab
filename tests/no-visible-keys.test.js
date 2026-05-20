// tests/no-visible-keys.test.js — Ensure no i18n keys are visible as raw text.
//
// An unresolved key looks like: index.label.moisture
// Pattern: one or more groups of word characters separated by dots.
// After i18n.t() resolves, text should NOT match this pattern.

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it } from 'node:test';
import assert from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PAGES = ['index.html', 'fine-tune.html', 'uhpc.html'];

// Pattern that matches unresolved i18n keys: word.word or word.word.word etc.
// Must start with a known i18n prefix (index, global, head, fine_tune, etc.)
const UNRESOLVED_KEY_PATTERN = /\b[a-z]+(?:_[a-z]+|\.[a-z]+)+(?:\.[a-z]+)*\b/gi;

// Keys that are known to be valid text containing dots (not unresolved keys)
const KNOWN_DOT_TEXT = new Set([
  // These are legitimate text content that happens to contain dots
]);

// Common English/Latin abbreviations that look like keys but aren't
const KNOWN_ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'cf', 'al', 'et al']);

function isUnresolvedKey(text, catalogue) {
  // Must match key-like pattern
  if (!/^[a-z]+(?:_[a-z]+|\.[a-z]+)+$/i.test(text)) return false;
  // Must not exist in the catalogue
  if (catalogue[text] !== undefined) return false;
  // Exclude known abbreviations
  if (KNOWN_ABBREVIATIONS.has(text)) return false;
  return true;
}

function checkPage(name, html, locale) {
  const de = JSON.parse(readFileSync(join(ROOT, 'locales', 'de.json'), 'utf8'));
  const en = JSON.parse(readFileSync(join(ROOT, 'locales', 'en.json'), 'utf8'));
  const catalogue = locale === 'en' ? en : de;

  const dom = new JSDOM(html, {
    url: 'http://localhost',
    runScripts: 'outside-only',
  });
  const document = dom.window.document;

  // Manually apply i18n translations (no DOM i18n module available in Node)
  const elements = document.querySelectorAll('[data-i18n]');
  for (const el of elements) {
    const key = el.getAttribute('data-i18n');
    const translated = catalogue[key] || key; // fallback to key if missing
    el.textContent = translated;
  }

  // Also handle placeholders
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', catalogue[key] || key);
  }

  // Check all text content for unresolved keys
  const found = [];
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const text = el.textContent.trim();
    // Check if the full text is an unresolved key
    if (isUnresolvedKey(text, catalogue)) {
      if (!found.includes(text)) found.push(text);
    }
    // Also check for keys embedded in text
    const matches = text.match(UNRESOLVED_KEY_PATTERN);
    if (matches) {
      for (const m of matches) {
        if (isUnresolvedKey(m, catalogue) && !found.includes(m)) {
          found.push(m);
        }
      }
    }
  }

  return found;
}

describe('no-visible-keys', () => {
  for (const page of PAGES) {
    it(`no unresolved keys in ${page} (de)`, () => {
      const html = readFileSync(join(ROOT, page), 'utf8');
      const unresolved = checkPage(page, html, 'de');
      if (unresolved.length > 0) {
        console.error(`  Unresolved keys in ${page}:`);
        unresolved.forEach(k => console.error(`    - ${k}`));
      }
      assert.strictEqual(unresolved.length, 0, `Found ${unresolved.length} unresolved i18n keys in ${page}: ${unresolved.join(', ')}`);
    });

    it(`no unresolved keys in ${page} (en)`, () => {
      const html = readFileSync(join(ROOT, page), 'utf8');
      const unresolved = checkPage(page, html, 'en');
      if (unresolved.length > 0) {
        console.error(`  Unresolved keys in ${page}:`);
        unresolved.forEach(k => console.error(`    - ${k}`));
      }
      assert.strictEqual(unresolved.length, 0, `Found ${unresolved.length} unresolved i18n keys in ${page}: ${unresolved.join(', ')}`);
    });
  }
});
