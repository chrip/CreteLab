// scripts/embed-locales.js — Embed locales/de.json into js/lib/i18n.js as _deCatalogue
// Updates js/lib/i18n.js in-place: replaces only the JSON content of _deCatalogue.
// Does NOT touch the public API code — that is preserved from the source file.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const i18nPath = join(ROOT, 'js', 'lib', 'i18n.js');
const raw = readFileSync(join(ROOT, 'locales', 'de.json'), 'utf8');
const catalogue = JSON.parse(raw);

// Strip metadata keys that shouldn't go in runtime catalogue
const SKIP = new Set([
  'global.skip.to.content',
]);

const filtered = {};
for (const [k, v] of Object.entries(catalogue)) {
  if (!SKIP.has(k)) {
    filtered[k] = v;
  }
}

const embedded = JSON.stringify(filtered);

// Read the current source file and replace only the _deCatalogue JSON content.
// Pattern: const _deCatalogue = <JSON>;
const source = readFileSync(i18nPath, 'utf8');
const updated = source.replace(
  /(const _deCatalogue = )\{[\s\S]*?\};/,
  `$1${embedded};`,
);

writeFileSync(i18nPath, updated, 'utf8');

console.log('Done. Embedded', Object.keys(filtered).length, 'keys into i18n.js');
