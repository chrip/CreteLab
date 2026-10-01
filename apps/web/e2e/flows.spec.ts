import { expect, test } from '@playwright/test';
import { TEXT, mockApi } from './api';

test.describe('start page', () => {
  test('a component goes to the planner with the recipe, the URL carries the state', async ({ page }) => {
    await mockApi(page);
    await page.goto('/de');
    await page.getByRole('textbox', { name: 'Projektbeschreibung' }).fill(TEXT.foundation);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/de\/plan\?.*v=1\.2/);
    await expect(page.getByRole('heading', { name: 'Was Sie brauchen' })).toBeVisible();
    await expect(page.getByText('1,20 m³ Beton')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Selbst mischen/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').getByRole('table', { name: 'Rezept' })).toContainText('Zement CEM I 42.5 N');
  });

  test('a thin piece goes to the fine concrete page with its sizes', async ({ page }) => {
    await mockApi(page);
    await page.goto('/de');
    await page.getByRole('button', { name: TEXT.planter }).click();
    await expect(page).toHaveURL(/\/de\/fine-concrete\?/);
    await expect(page.getByText('Hier sind Sie richtig')).toBeVisible();
    await expect(page.getByLabel('Wandstärke in cm')).toHaveValue('2');
    await expect(page.getByText('Menge: 15 l')).toBeVisible();
  });

  test('the examples disappear after a search', async ({ page }) => {
    await mockApi(page);
    await page.goto('/de/plan');
    await expect(page.locator('.examples')).toHaveCount(0);
    await page.goto('/de');
    await expect(page.getByText('Beispiele:')).toBeVisible();
  });

  test('a failing model is reported, the tools still work', async ({ page }) => {
    await mockApi(page, { status: 500 });
    await page.goto('/de');
    await page.getByRole('textbox', { name: 'Projektbeschreibung' }).fill(TEXT.foundation);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('HTTP 500');
    await expect(page).toHaveURL(/\/de$/);
  });

  test('a busy model (rate limit or all slots taken) asks to try again', async ({ page }) => {
    await mockApi(page, { status: 429 });
    await page.goto('/de');
    await page.getByRole('textbox', { name: 'Projektbeschreibung' }).fill(TEXT.foundation);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('in ein paar Sekunden');
  });
});

test.describe('component planner', () => {
  test('three ways to make it, with a sourced reason when bags do not work', async ({ page }) => {
    await mockApi(page);
    await page.goto('/de');
    await page.getByRole('textbox', { name: 'Projektbeschreibung' }).fill(TEXT.driveway);
    await page.keyboard.press('Enter');
    await expect(page.getByText('2,70 m³ Beton C35/45')).toBeVisible();
    await expect(page.getByTestId('volume-formula')).toHaveText('6 m × 3 m × 0,15 m = 2,70 m³');

    await page.getByRole('tab', { name: /Fertigmischung/ }).click();
    await expect(page.getByText('Mit Sackbeton geht es hier nicht.')).toBeVisible();

    await page.getByRole('tab', { name: /Transportbeton/ }).click();
    await expect(page.getByTestId('order-text')).toContainText('C35/45 · XC4, XD3, XF4, XM1 · WA · F2 · Dmax 32 mm · Cl 0,40');
    await expect(page).toHaveURL(/tab=order/);
  });

  test('a watertight basement wall: C25/30 and WU, the wall volume from its roles', async ({ page }) => {
    await mockApi(page);
    await page.goto('/de');
    await page.getByRole('textbox', { name: 'Projektbeschreibung' }).fill(TEXT.basement);
    await page.keyboard.press('Enter');
    await expect(page.getByText('4,80 m³ Beton C25/30')).toBeVisible();
    await expect(page.getByText('Wasserundurchlässig: WU-Beton')).toBeVisible();
    await page.getByRole('tab', { name: /Fertigmischung/ }).click();
    await expect(page.getByText('Kein Sackbeton ist als WU-Beton deklariert')).toBeVisible();
  });

  test('bags asked for but impossible: another way is recommended and the reason is given', async ({ page }) => {
    await mockApi(page);
    await page.goto('/de');
    await page.getByRole('textbox', { name: 'Projektbeschreibung' }).fill(TEXT.basementBagged);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('bag-rejected')).toContainText('Empfohlen ist deshalb: Transportbeton');
    await expect(page.getByRole('tab', { name: /Transportbeton/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /Fertigmischung/ }).locator('.badge')).toHaveCount(0);
  });

  test('details change the recipe at once and survive a reload', async ({ page }) => {
    await page.goto('/de/plan?v=2&s=C20%2F25&x=XC1');
    await page.getByText('Rezept anpassen').click();
    await page.getByLabel('Druckfestigkeitsklasse').selectOption('C30/37');
    await expect(page.getByText('2,00 m³ Beton C30/37')).toBeVisible();
    await expect(page).toHaveURL(/s=C30%2F37|s=C30\/37/);
    await page.reload();
    await expect(page.getByText('2,00 m³ Beton C30/37')).toBeVisible();
  });

  test('arrow keys move between the tabs', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation');
    await page.goto('/de/plan');
    await page.getByRole('tab', { name: /Selbst mischen/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Transportbeton/ })).toBeFocused();
    await expect(page.getByRole('tab', { name: /Transportbeton/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('a shared link asks the model again but keeps the edited values', async ({ page }) => {
    const calls = await mockApi(page);
    const q = encodeURIComponent(TEXT.foundation);
    await page.goto(`/de/plan?q=${q}&v=5&s=C30%2F37`);
    await expect(page.getByRole('heading', { name: 'Das wurde automatisch verstanden' })).toBeVisible();
    await expect(page.getByText('5,00 m³ Beton C30/37')).toBeVisible();
    expect(calls).toEqual([TEXT.foundation]);
  });
});

test.describe('language', () => {
  test('switching the language keeps the page and every value', async ({ page }) => {
    await page.goto('/de/plan?v=3&s=C30%2F37&x=XC4%2CXF1&tab=order');
    await page.getByRole('link', { name: 'Sprache wechseln: English' }).click();
    // Hydration and the language switch can take a while on a busy machine.
    await expect(page).toHaveURL(/\/en\/plan\?/, { timeout: 15_000 });
    await expect(page.getByText('3.00 m³ of C30/37 concrete')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Ready-mixed concrete/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('an English description gets an English page', async ({ page }) => {
    await mockApi(page);
    await page.goto('/en');
    await page.getByRole('textbox', { name: 'Project description' }).fill(TEXT.postsEn);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/en\/plan/);
    await expect(page.getByRole('heading', { name: 'What you need' })).toBeVisible();
  });
});

test.describe('fine concrete page and bag tool', () => {
  test('sizes give the volume and scale the recipe', async ({ page }) => {
    await page.goto('/de/fine-concrete?shape=cylinder&d=40&h=35&t=2.5');
    await expect(page.getByText(/Menge: \d/)).toBeVisible();
    await page.getByLabel('Durchmesser in cm').fill('60');
    await expect(page).toHaveURL(/d=60/);
    await page.getByLabel('Ausgangsrezept').selectOption('diy-white-bowl-4kg');
    await expect(page.getByText('Glasfasern (AR)')).toBeVisible();
  });

  test('the bag tool warns first and estimates the effect of additions', async ({ page }) => {
    await page.goto('/de/bag');
    await expect(page.getByText('Nur zum Ausprobieren.')).toBeVisible();
    await page.getByLabel(/Luftporenbildner/).check();
    await page.getByLabel(/Silikastaub/).check();
    await expect(page.getByText('Luftporen und Silikastaub vertragen sich schlecht')).toBeVisible();
    await expect(page).toHaveURL(/lp=1/);
  });

  test('the about page is English and links to the repository', async ({ page }) => {
    await page.goto('/de/about');
    await expect(page.getByRole('heading', { name: 'About CreteLab' })).toBeVisible();
    await expect(page.locator('article')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('link', { name: 'GitHub' }).first()).toHaveAttribute('href', 'https://github.com/chrip/CreteLab');
  });
});

test.describe('link previews', () => {
  test('the start page has Open Graph title and description in plain words', async ({ page }) => {
    await page.goto('/de');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Beton für Ihr Projekt · CreteLab');
    const description = page.locator('meta[property="og:description"]');
    await expect(description).toHaveAttribute('content', /nach DIN-Norm/);
    await expect(description).not.toHaveAttribute('content', /Merkblatt/);
  });
});

test.describe('legal pages', () => {
  test('legal notice and privacy policy are linked from every page footer', async ({ page }) => {
    for (const path of ['/de', '/de/plan', '/de/fine-concrete', '/en/about']) {
      await page.goto(path);
      await expect(page.locator('footer').getByRole('link', { name: /Impressum|Legal notice/ })).toBeVisible();
      await expect(page.locator('footer').getByRole('link', { name: /Datenschutz|Privacy/ })).toBeVisible();
    }
    await page.goto('/de');
    await page.locator('footer').getByRole('link', { name: 'Datenschutz' }).click();
    await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible();
    await page.locator('footer').getByRole('link', { name: 'Impressum' }).click();
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
  });
});
