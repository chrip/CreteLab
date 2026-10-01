import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.1 AA checks on every page, in both languages.
const PAGES = ['/de', '/en', '/de/plan?v=2&s=C25%2F30&x=XC4%2CXF1', '/de/fine-concrete', '/de/bag', '/en/about', '/de/legal', '/de/privacy'];

for (const path of PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

// The strength scale tints its steps with the accent colour; check both colour schemes.
for (const scheme of ['light', 'dark'] as const) {
  test(`the strength scale keeps its contrast in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ['/de/plan?v=2&s=C25%2F30&x=XC4%2CXF1', '/de/bag?zc=1']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page }).include('[data-testid="strength-scale"]').withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
}
