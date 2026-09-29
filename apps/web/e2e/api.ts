import { readFileSync, readdirSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** Answers recorded from the real laya-crete model, keyed by description. */
const FIXTURES = new Map(
  readdirSync(new URL('./fixtures/', import.meta.url))
    .map((f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8')))
    .map((d) => [d.text as string, d]),
);

export const TEXT = {
  driveway: 'Einfahrt 6 x 3 m, 15 cm stark, im Winter wird gestreut',
  planter: 'Blumenkübel für den Balkon 40x40x40 cm, Wandstärke 2 cm',
  foundation: 'Fundament für ein Gartenhaus 3x2 m, 20 cm dick',
  basement: 'Kellerwand im Grundwasser, 8 m lang, 2,5 m hoch, 24 cm dick',
  postsEn: 'Setting 12 fence posts in concrete',
  basementBagged: 'Kellerwand im Grundwasser, 8 m lang, 2,5 m hoch, 24 cm dick, mit Fertigbeton aus dem Baumarkt',
};

/** Serve the recorded answers; counts the requests so tests can check the cache. */
export async function mockApi(page: Page, { status = 200 }: { status?: number } = {}) {
  const calls: string[] = [];
  await page.route('**/api/describe', async (route) => {
    const { text } = route.request().postDataJSON() as { text: string };
    calls.push(text);
    const fixture = FIXTURES.get(text);
    if (status !== 200 || !fixture) return route.fulfill({ status: fixture ? status : 500, body: 'error' });
    const { text: _text, ...body } = fixture;
    return route.fulfill({ json: body });
  });
  return calls;
}
