// Writes the Content-Security-Policy for the generated site as an nginx snippet.
// Nuxt puts two small inline scripts into every page (the import map and the runtime
// config); they are allowed by their SHA-256 hash instead of 'unsafe-inline'.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../.output/public/', import.meta.url).pathname;

function* htmlFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

/** Hashes of inline scripts the browser executes (JSON data blocks are not executed). */
export function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, body] = m;
    if (/\bsrc=/.test(attrs) || !body || /type="application\/json"/.test(attrs)) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
  return hashes;
}

export function policy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].sort().join(' ')}`,
    // Vue's scoped styles are inline <style> blocks.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const hashes = new Set();
  for (const f of htmlFiles(root)) for (const h of inlineScriptHashes(readFileSync(f, 'utf8'))) hashes.add(h);
  const out = new URL('../.output/csp.conf', import.meta.url).pathname;
  writeFileSync(out, `add_header Content-Security-Policy "${policy(hashes)}" always;\n`);
  console.log(`csp: ${hashes.size} inline script hashes -> ${out}`);
}
