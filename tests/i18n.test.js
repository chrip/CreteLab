import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

// ── i18n module tests (JSDOM) ──────────────────────────────────────────

describe('i18n JSDOM integration', () => {
  async function loadI18n() {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost/',
      runScripts: 'dangerously',
      resources: 'usable',
    });

    const script = dom.window.document.createElement('script');
    const i18nSource = fs.readFileSync(path.resolve('js/lib/i18n.js'), 'utf8');
    // Replace import.meta.url with a synthetic URL so the _base path resolves correctly
    let synthetic = i18nSource.replace(
      "import.meta.url",
      "'http://localhost/js/lib/i18n.js'",
    );
    // Strip ESM-only export statement — JSDOM does not expose ESM exports on window
    synthetic = synthetic.replace('export const i18n =', 'const i18n =');

    script.textContent = synthetic;
    dom.window.document.head.appendChild(script);

    // Wait for script to evaluate
    await new Promise(resolve => dom.window.setTimeout(resolve, 50));
    return dom.window.i18n;
  }

  it('i18n.js loads without errors in JSDOM and translates keys', async () => {
    const i18n = await loadI18n();
    assert.ok(i18n, 'i18n should be available on window');

    // German (embedded) should work immediately
    assert.strictEqual(i18n.locale, 'de');
    const de = i18n.t('index.label.volume');
    assert.ok(typeof de === 'string' && de.length > 0, 'German translation should resolve');
    assert.ok(!de.includes('index.label.volume'), 'Should not return raw key');

    // English should cascade to German when key not embedded
    await i18n.setLocale('en');
    const en = i18n.t('index.label.volume');
    assert.ok(typeof en === 'string' && en.length > 0, 'English translation should resolve via cascade');

    // Switch back to German
    await i18n.setLocale('de');
    assert.strictEqual(i18n.locale, 'de');
  });

  it('i18n.t handles variable substitution', async () => {
    const i18n = await loadI18n();
    const result = i18n.t('index.admixture.bv.hint', { saving: '7', dosage: '1.5' });
    assert.ok(result.includes('7'), 'Variable {saving} should be substituted');
    assert.ok(result.includes('1.5'), 'Variable {dosage} should be substituted');
  });

  it('i18n.t cascade fallback works across locales', async () => {
    const i18n = await loadI18n();

    // Test underscore → dot cascade
    const dotResult = i18n.t('index.label_volume');
    assert.ok(dotResult !== 'index.label_volume', 'Underscore→dot cascade should resolve');

    // Test prefix cascade
    const cascadeResult = i18n.t('index.label.volume.nonexistent');
    assert.ok(cascadeResult !== 'index.label.volume.nonexistent', 'Prefix cascade should resolve');
  });

  it('i18n.patchDom updates data-i18n attributes', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><span data-i18n="global.language"></span></body></html>', {
      url: 'http://localhost/',
      runScripts: 'dangerously',
      resources: 'usable',
    });

    const i18nSource = fs.readFileSync(path.resolve('js/lib/i18n.js'), 'utf8');
    let synthetic = i18nSource.replace(
      "import.meta.url",
      "'http://localhost/js/lib/i18n.js'",
    );
    // Strip ESM-only export statement
    synthetic = synthetic.replace('export const i18n =', 'const i18n =');

    const script = dom.window.document.createElement('script');
    script.textContent = synthetic;
    dom.window.document.head.appendChild(script);

    await new Promise(resolve => dom.window.setTimeout(resolve, 50));

    const i18n = dom.window.i18n;
    i18n.patchDom();

    const span = dom.window.document.querySelector('span');
    assert.ok(span.textContent.length > 0, 'data-i18n span should have translated text');
    assert.ok(!span.textContent.includes('global.language'), 'Should not contain raw key');
  });
});

// ── Render output validation ───────────────────────────────────────────

describe('Render output', () => {
  it('build/ directory contains all locale pages', () => {
    const build = path.resolve('build');
    const expected = [
      'index.html',
      'de/index.html',
      'de/fine-tune.html',
      'de/uhpc.html',
      'en/index.html',
      'en/fine-tune.html',
      'en/uhpc.html',
    ];
    for (const page of expected) {
      const p = path.join(build, page);
      assert.ok(fs.existsSync(p), `${page} should exist in build/`);
      const content = fs.readFileSync(p, 'utf8');
      assert.ok(content.length > 1000, `${page} should have substantial content (${content.length} bytes)`);
    }
  });

  it('German pages contain translated text (not raw keys)', () => {
    const build = path.resolve('build');
    const dePages = ['de/index.html', 'de/fine-tune.html', 'de/uhpc.html'];
    for (const page of dePages) {
      const content = fs.readFileSync(path.join(build, page), 'utf8');
      // Check that common keys are translated
      assert.ok(content.includes('Betonrechner') || content.includes('Betonrezept'),
        `${page} should contain German text`);
      // The data-i18n attribute is expected to remain (used by client-side i18n),
      // but the text content should be translated (not a raw key).
      assert.ok(content.includes('Benötigtes Volumen') || content.includes('Required volume'),
        `${page} should have translated volume label text`);
    }
  });

  it('English pages contain translated text', () => {
    const build = path.resolve('build');
    const enPages = ['en/index.html', 'en/fine-tune.html', 'en/uhpc.html'];
    for (const page of enPages) {
      const content = fs.readFileSync(path.join(build, page), 'utf8');
      assert.ok(content.includes('concrete') || content.includes('Concrete'),
        `${page} should contain English text`);
    }
  });

  it('i18n.js embedded catalogue has all expected keys', () => {
    const i18nContent = fs.readFileSync(path.resolve('js/lib/i18n.js'), 'utf8');
    // Check that the embedded catalogue is present and not corrupted
    assert.ok(i18nContent.includes('const _deCatalogue ='), 'Should have _deCatalogue');
    assert.ok(i18nContent.includes('const _catalogues = { de: _deCatalogue, en: null }'),
      'Should have _catalogues definition');
    assert.ok(i18nContent.includes('export const i18n ='), 'Should have exported i18n object');
    assert.ok(i18nContent.includes('i18n.t('), 'Should have i18n.t method');
    assert.ok(i18nContent.includes('i18n.patchDom'), 'Should have i18n.patchDom method');
    assert.ok(i18nContent.includes('i18n.setLocale'), 'Should have i18n.setLocale method');
    // Should NOT have duplicate content from stale backup
    const backupMarker = 'const _deCatalogue =';
    const matches = i18nContent.match(new RegExp(backupMarker, 'g'));
    assert.strictEqual(matches?.length, 1,
      'Should have exactly one _deCatalogue definition (no duplicate from stale backup)');
  });

  it('embed-locales.js does not corrupt i18n.js', async () => {
    const original = fs.readFileSync(path.resolve('js/lib/i18n.js'), 'utf8');
    const originalLines = original.split('\n').length;

    // Run embed script
    await import('child_process').then(({ execSync }) => {
      execSync('node scripts/embed-locales.js', { stdio: 'pipe' });
    });

    const updated = fs.readFileSync(path.resolve('js/lib/i18n.js'), 'utf8');
    const updatedLines = updated.split('\n').length;

    // File should not grow unboundedly — same number of lines (catalogue size varies slightly)
    const lineDiff = Math.abs(updatedLines - originalLines);
    assert.ok(lineDiff < 10,
      `i18n.js should not grow unboundedly after embed (${lineDiff} line difference)`);

    // Restore original
    fs.writeFileSync(path.resolve('js/lib/i18n.js'), original);
  });
});
