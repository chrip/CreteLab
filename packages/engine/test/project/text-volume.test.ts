// Plain-text volume parser (ported from the parseVolume parts of tests/describe.test.js).
import { describe, expect, it } from 'vitest';
import { DIY_DEFAULT_VOLUME_M3 } from '../../src/project/plan';
import { parseVolume } from '../../src/project/volume';

describe('parseVolume', () => {
  it.each([
    ['Ich brauche 2,5 m³ für den Keller', 2.5, 'volume'],
    ['3 Kubik Beton fürs Fundament', 3, 'volume'],
    ['halber Kubik reicht', 0.5, 'volume'],
    ['500 Liter für Pfosten', 0.5, 'volume'],
    ['Fundament für Gartenhaus 3x2 m, 20 cm dick', 1.2, 'dimensions'],
    ['Einfahrt 25 m² und 15 cm stark', 3.75, 'dimensions'],
    ['Punktfundament 40x40x80 cm', 0.13, 'dimensions'],
    ['slab 4 x 3 m, 12 cm thick', 1.44, 'dimensions'],
    ['Terrasse hinterm Haus', 1, 'default'],
    // An area without a thickness is not a volume.
    ['Terrasse 20 qm', 1, 'default'],
  ])('%s → %s m³ (%s)', (text, volume, source) => {
    const r = parseVolume(text);
    expect(r.source).toBe(source);
    expect(r.volume).toBe(volume);
  });

  it('keeps the text it read the volume from', () => {
    expect(parseVolume('Einfahrt 25 m² und 15 cm stark').match).toBe('25 m² · 15 cm stark');
    expect(parseVolume('Punktfundament 40x40x80 cm').match).toBe('40x40x80 cm');
  });

  it('reads dimensions without a unit from 10 up as cm', () => {
    expect(parseVolume('Sockel 40x40x50').volume).toBe(0.08);
  });
});

describe('parseVolume: DIY pieces', () => {
  it('keeps litre precision for small pieces: Tischplatte 120x60x3 cm → 21,6 l', () => {
    expect(parseVolume('Tischplatte 120x60x3 cm').volume).toBe(0.0216);
  });

  it('assumes 10 l for a DIY piece without a size', () => {
    expect(parseVolume('Blumenkübel gießen', { defaultVolume: DIY_DEFAULT_VOLUME_M3 })).toEqual({ volume: 0.01, source: 'default' });
  });

  it('site concrete still defaults to 1 m³', () => {
    expect(parseVolume('Terrasse hinterm Haus').volume).toBe(1);
  });

  it('reads a stated small volume in litres', () => {
    expect(parseVolume('Obstschale, ca. 3 Liter')).toMatchObject({ volume: 0.003, source: 'volume' });
  });
});

describe('parseVolume: hollow cast pieces (one side open unless stated)', () => {
  it.each([
    // 0,9³ − 0,86·0,86·0,88
    ['ein imperialer sitzwürfel cubisch, 90 cm Seitenlänge wandicke 2 cm, für den Garten', 0.0782, 'one'],
    // 0,064 − 0,36·0,36·0,38
    ['Blumenkübel 40x40x40 cm, Wandstärke 2 cm', 0.0148, 'one'],
    // 0,072 − 0,54·0,24·0,37
    ['Pflanzkübel 60x30x40 cm, 3 cm Wand', 0.024, 'one'],
    // 0,45³ − 0,41·0,41·0,43
    ['Garden cube seat 45 cm, wall thickness 2 cm', 0.0188, 'one'],
    // 0,125 − 0,44³
    ['Hohlwürfel geschlossen, Kantenlänge 50 cm, Wandstärke 3 cm', 0.0398, 'none'],
    // 0,3 · (0,36 − 0,52²)
    ['Betonring 60x60x30 cm ohne Boden, Wand 4 cm', 0.0269, 'both'],
  ])('%s → %s m³ (%s)', (text, volume, open) => {
    const r = parseVolume(text);
    expect(r.source).toBe('hollow');
    expect(r.open).toBe(open);
    expect(r.volume).toBe(volume);
  });

  it('reports the wall thickness and the shape', () => {
    expect(parseVolume('Blumenkübel 40x40x40 cm, Wandstärke 2 cm')).toMatchObject({ shape: 'hollow', wall: 0.02 });
  });

  it('a slab thickness ("20 cm dick") is not a wall', () => {
    expect(parseVolume('Fundament für ein Gartenhaus 3x2 m, 20 cm dick').source).toBe('dimensions');
  });

  it('a bare "Wand" needs mm or cm to count as wall thickness', () => {
    expect(parseVolume('Kellerwand 5x3x2 m').source).not.toBe('hollow');
  });

  it('a wall thickness without an outer size falls back to the other rules', () => {
    expect(parseVolume('Schale mit Wandstärke 2 cm').source).toBe('default');
  });
});

describe('text volumes explain themselves', () => {
  it('dimensions with a thickness become a slab breakdown', () => {
    expect(parseVolume('Einfahrt 6 x 3 m, 15 cm stark').breakdown?.outer).toEqual({ kind: 'box', length: 6, width: 3, height: 0.15 });
  });

  it('an area with a thickness', () => {
    expect(parseVolume('25 m² und 15 cm stark').breakdown?.outer).toEqual({ kind: 'area', area: 25, height: 0.15 });
  });

  it('a stated amount has no breakdown', () => {
    expect(parseVolume('2 m³ Beton').breakdown).toBeUndefined();
  });
});

describe('mixed units', () => {
  it.each([
    ['Waschbecken 1m x 0.5m x 20 cm', 0.1],
    ['Platte 1,2 m x 80 cm, 4 cm dick', 0.0384],
    ['Kübel 40 x 40 cm x 0,5 m', 0.08],
    ['40 x 40 cm x 40 cm', 0.064],
  ])('%s → %s m³', (text, volume) => {
    expect(parseVolume(text).volume).toBeCloseTo(volume, 6);
  });
});
