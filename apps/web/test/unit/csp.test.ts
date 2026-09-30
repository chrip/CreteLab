import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ES module without types
import { inlineScriptHashes, policy } from '../../scripts/csp.mjs';

describe('Content-Security-Policy', () => {
  it('hashes executable inline scripts only', () => {
    const html = [
      '<script type="importmap">{"imports":{}}</script>',
      '<script type="module" src="/_nuxt/a.js"></script>',
      '<script>window.__NUXT__={}</script>',
      '<script type="application/json" id="data">[1]</script>',
    ].join('');
    const hashes = [...inlineScriptHashes(html)];
    expect(hashes).toHaveLength(2);
    // sha256 of "window.__NUXT__={}"
    expect(hashes).toContain("'sha256-9t9kOTpBXQ6UK6UoTUcY2ezm5KT7oB5pbv8ZFsTUBAU='");
  });

  it('allows no inline scripts beyond the hashes and no framing', () => {
    const p = policy(new Set(["'sha256-abc'"]));
    expect(p).toContain("script-src 'self' 'sha256-abc'");
    expect(p).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(p).toContain("frame-ancestors 'none'");
    expect(p).toContain("object-src 'none'");
  });
});
