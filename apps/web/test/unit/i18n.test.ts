// The GUI is bilingual: both languages have the same keys, and every key the code uses exists.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  AGGREGATE_TYPES, BAG_RULES, CEMENT_TYPE_NAMES, CONSISTENCY_CLASSES, DECOR_PRESETS, EXPOSURE_CLASS_NAMES,
  PLASTICIZERS, SIEVE_LINE_NAMES, STRENGTH_CLASS_NAMES,
} from '@cretelab/engine';
import { describe, expect, it } from 'vitest';

type Messages = { [key: string]: string | Messages | Messages[] };
const load = (lang: string): Messages =>
  JSON.parse(readFileSync(new URL(`../../i18n/locales/${lang}.json`, import.meta.url), 'utf8'));
const de = load('de');
const en = load('en');

function flatten(m: Messages | Messages[] | string, prefix = ''): Record<string, string> {
  if (typeof m === 'string') return { [prefix.slice(0, -1)]: m };
  return Object.entries(m).reduce<Record<string, string>>((acc, [k, v]) => ({ ...acc, ...flatten(v, `${prefix}${k}.`) }), {});
}
const flatDe = flatten(de);
const flatEn = flatten(en);

const APP = new URL('../../app/', import.meta.url).pathname;
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.(vue|ts)$/.test(e.name) ? [readFileSync(join(dir, e.name), 'utf8')] : [],
  );
}
const code = sources(APP).join('\n');

describe('locales', () => {
  it('German and English have exactly the same keys', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatDe).sort());
  });

  it('no message is empty', () => {
    for (const [key, value] of [...Object.entries(flatDe), ...Object.entries(flatEn)]) expect(value.trim(), key).not.toBe('');
  });

  it('both languages use the same placeholders', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(flatDe)) expect(names(flatEn[key]!), key).toEqual(names(flatDe[key]!));
  });

  it('messages avoid characters vue-i18n treats as syntax (| for plurals, @ for links)', () => {
    for (const [key, value] of [...Object.entries(flatDe), ...Object.entries(flatEn)]) expect(value, key).not.toMatch(/[|@]/);
  });

  it('every literal key in the code exists', () => {
    const used = [...code.matchAll(/\bt\(\s*'([\w.-]+)'/g), ...code.matchAll(/\$t\(\s*'([\w.-]+)'/g)].map((m) => m[1]!);
    const labels = [...code.matchAll(/submit-label="([\w.-]+)"/g)].map((m) => m[1]!);
    const missing = [...new Set([...used, ...labels])].filter((k) => !(k in flatDe));
    expect(missing).toEqual([]);
    expect(used.length).toBeGreaterThan(50);
  });

  // Keys built from engine values: a new strength class or preset must come with its texts.
  const key = (value: string) => value.replace(/[./ ]/g, '_');
  it.each([
    ['option.strength', STRENGTH_CLASS_NAMES.map(key)],
    ['option.sieve', SIEVE_LINE_NAMES.map(key)],
    ['option.consistency', [...CONSISTENCY_CLASSES]],
    ['option.aggregate', AGGREGATE_TYPES],
    ['option.cement', CEMENT_TYPE_NAMES.map(key)],
    ['option.plasticizer', [...PLASTICIZERS]],
    ['option.exposure', EXPOSURE_CLASS_NAMES.flatMap((c) => [`${c}.name`, `${c}.description`])],
    ['reason', EXPOSURE_CLASS_NAMES.map((c) => c.toLowerCase()).concat(['lp', 'wu'])],
    ['bag.rule', [...BAG_RULES]],
    ['fineConcrete.presets', DECOR_PRESETS.flatMap((p) => [`${p.key}.label`, `${p.key}.use`])],
  ])('%s has a text for every engine value', (prefix, values) => {
    for (const v of values) expect(flatDe, `${prefix}.${v}`).toHaveProperty([`${prefix}.${v}`]);
  });

  it('every fine concrete preset has as many mixing steps as the engine says', () => {
    for (const p of DECOR_PRESETS) {
      for (const lang of [flatDe, flatEn]) {
        for (let i = 0; i < p.steps; i++) expect(lang, `${p.key} step ${i}`).toHaveProperty([`fineConcrete.presets.${p.key}.steps.${i}.title`]);
        expect(lang).not.toHaveProperty([`fineConcrete.presets.${p.key}.steps.${p.steps}.title`]);
      }
    }
  });
});
