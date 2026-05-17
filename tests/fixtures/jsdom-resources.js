// jsdom-resources.js — Shared JSDOM resource loader that silences CSS warnings.
// Tests don't need actual stylesheets; this suppresses the

import https from 'https';
import http from 'http';

class SilentResourceLoader {
  fetch(url, options) {
    // Silently skip CSS and image loads — tests only need scripts
    if (/\.(css|png|jpg|gif|ico|svg|woff2?)$/i.test(url)) {
      return Promise.resolve(null);
    }
    // Fetch everything else (JS modules, etc.)
    const agent = new (url.startsWith('https') ? https.Agent : http.Agent)({
      rejectUnauthorized: false,
    });
    return fetch(url, { ...options, agent }).then(res =>
      res.ok ? res.buffer() : null,
    ).catch(() => null);
  }
}

export { SilentResourceLoader };
