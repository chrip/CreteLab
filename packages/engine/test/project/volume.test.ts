// Volume from Laya's shape and roles (ported from tests/volume.test.js).
import { describe, expect, it } from 'vitest';
import { roundVolume } from '../../src/project/geometry';
import type { Answers } from '../../src/project/answers';
import { parseCandidate, resolveVolume, volumeFromAnswers, wallFromAnswers } from '../../src/project/volume';

/** Laya's answers as the server returns them: shape, open_sides and role:<candidate>. */
const ans = (shape: string, open: string, roles: Record<string, string>): Answers => ({
  shape: { choice: shape },
  open_sides: { choice: open },
  ...Object.fromEntries(Object.entries(roles).map(([c, r]) => [`role:${c}`, { choice: r }])),
});

/**
 * volumeFromAnswers now rounds itself (roundVolume: 4 decimals below 0,1 m³, 2 above); the
 * old JS rounded only in resolveVolume. So the exact formula is compared after rounding.
 */
const near = (actual: number | undefined, expected: number) => {
  expect(actual).toBe(roundVolume(expected));
};

describe('parseCandidate', () => {
  it('reads the candidate texts of services/api measurements.py', () => {
    expect(parseCandidate('90 cm')).toEqual({ kind: 'length', value: 0.9 });
    expect(parseCandidate('2,5 cm')).toEqual({ kind: 'length', value: 0.025 });
    expect(parseCandidate('40 cm #2')).toEqual({ kind: 'length', value: 0.4 });
    expect(parseCandidate('30x30x80 cm')?.kind).toBe('dims');
    expect(parseCandidate('25 m²')).toEqual({ kind: 'area', value: 25 });
    expect(parseCandidate('2 kubik')).toEqual({ kind: 'volume', value: 2 });
    expect(parseCandidate('500 liter')).toEqual({ kind: 'volume', value: 0.5 });
    expect(parseCandidate('12 zaunpfosten')).toEqual({ kind: 'count', value: 12 });
  });

  it('converts every size of a dimension triple to metres', () => {
    const c = parseCandidate('30x30x80 cm');
    expect(c?.kind).toBe('dims');
    if (c?.kind !== 'dims') return;
    c.size.forEach((v, i) => expect(v).toBeCloseTo([0.3, 0.3, 0.8][i]!, 12));
    expect(parseCandidate('3x2 m')).toEqual({ kind: 'dims', size: [3, 2] });
  });

  it('reads other units for lengths, areas and volumes', () => {
    expect(parseCandidate('150 mm')).toEqual({ kind: 'length', value: 0.15 });
    expect(parseCandidate('3 m')).toEqual({ kind: 'length', value: 3 });
    expect(parseCandidate('20 qm')).toEqual({ kind: 'area', value: 20 });
    expect(parseCandidate('1,5 m³')).toEqual({ kind: 'volume', value: 1.5 });
    expect(parseCandidate('10 l')).toEqual({ kind: 'volume', value: 0.01 });
  });

  it('rejects what it cannot read', () => {
    expect(parseCandidate('viel beton')).toBeNull();
    expect(parseCandidate('3x2 furlong')).toBeNull();
  });
});

describe('volume from shape and roles', () => {
  it('hollow seat cube, 90 cm edge, 2 cm wall, one side open: 0,9³ − 0,86·0,86·0,88', () => {
    const v = volumeFromAnswers(ans('hollow', 'one', { '90 cm': 'length', '2 cm': 'wall' }), ['90 cm', '2 cm']);
    near(v?.volume, 0.9 ** 3 - 0.86 * 0.86 * 0.88);
    expect(v).toMatchObject({ source: 'laya', shape: 'hollow', wall: 0.02, open: 'one', count: 1 });
  });

  it('round pot Ø 40 cm, 35 cm high, 2,5 cm wall: π/4·(0,4²·0,35 − 0,35²·0,325)', () => {
    const v = volumeFromAnswers(
      ans('hollow', 'one', { '40 cm': 'diameter', '35 cm': 'height', '2,5 cm': 'wall' }),
      ['40 cm', '35 cm', '2,5 cm'],
    );
    near(v?.volume, (Math.PI / 4) * (0.16 * 0.35 - 0.35 ** 2 * 0.325));
  });

  it('12 post holes 30x30x80 cm: 12 × 0,072', () => {
    const v = volumeFromAnswers(ans('block', 'solid', { '12 zaunpfosten': 'count' }), ['12 zaunpfosten', '30x30x80 cm']);
    near(v?.volume, 12 * 0.3 * 0.3 * 0.8);
    expect(v?.count).toBe(12);
  });

  it('6 point foundations 40 cm x 40 cm, 80 cm deep', () => {
    const v = volumeFromAnswers(
      ans('block', 'solid', { '6 punktfundamente': 'count', '80 cm': 'height' }),
      ['6 punktfundamente', '40x40 cm', '80 cm'],
    );
    near(v?.volume, 6 * 0.4 * 0.4 * 0.8);
  });

  it('pipe 1 m long, Ø 30 cm, 4 cm wall: π/4·(0,3² − 0,22²)·1', () => {
    const v = volumeFromAnswers(
      ans('ring', 'both', { '1 m': 'length', '30 cm': 'diameter', '4 cm': 'wall' }),
      ['1 m', '30 cm', '4 cm'],
    );
    near(v?.volume, (Math.PI / 4) * (0.09 - 0.22 ** 2));
    // Only hollow bodies report their open sides.
    expect(v?.open).toBeUndefined();
  });

  it('bowl Ø 30 cm, 1,5 cm wall: half-sphere shell', () => {
    const v = volumeFromAnswers(ans('bowl', 'one', { '30 cm': 'diameter', '1,5 cm': 'wall' }), ['30 cm', '1,5 cm']);
    near(v?.volume, (2 / 3) * Math.PI * (0.15 ** 3 - 0.135 ** 3));
  });

  it('driveway 25 m², 15 cm: area × thickness', () => {
    const v = volumeFromAnswers(ans('slab', 'solid', { '25 m²': 'area', '15 cm': 'thickness' }), ['25 m²', '15 cm']);
    near(v?.volume, 3.75);
  });

  it('a number of bags never multiplies the piece: "2 Säcken … 30x30x60 cm" stays 54 l', () => {
    const v = volumeFromAnswers(ans('block', 'solid', { '2 säcken': 'count' }), ['2 säcken', '30x30x60 cm']);
    near(v?.volume, 0.3 * 0.3 * 0.6);
    expect(v?.count).toBe(1);
  });

  it('a "block" given by diameter and depth is round: 3 holes Ø 30 cm × 60 cm', () => {
    const v = volumeFromAnswers(
      ans('block', 'solid', { '3 holes': 'count', '30 cm': 'diameter', '60 cm': 'height' }),
      ['3 holes', '30 cm', '60 cm'],
    );
    near(v?.volume, ((3 * Math.PI) / 4) * 0.09 * 0.6);
  });

  it('a wall thickness makes it hollow even if Laya says "block"', () => {
    const v = volumeFromAnswers(ans('block', 'one', { '90 cm': 'length', '2 cm': 'wall' }), ['90 cm', '2 cm']);
    near(v?.volume, 0.9 ** 3 - 0.86 * 0.86 * 0.88);
    expect(v?.shape).toBe('hollow');
  });

  it('a stated amount wins: "2 Kubik"', () => {
    expect(volumeFromAnswers(ans('hollow', 'one', { '2 kubik': 'volume' }), ['2 kubik'])?.volume).toBe(2);
  });

  it('closed and open-both hollow bodies follow open_sides', () => {
    const closed = volumeFromAnswers(ans('hollow', 'none', { '50 cm': 'length', '3 cm': 'wall' }), ['50 cm', '3 cm']);
    near(closed?.volume, 0.125 - 0.44 ** 3);
    expect(closed?.open).toBe('none');
    // An unknown open_sides answer ("solid") falls back to one open side.
    const unknown = volumeFromAnswers(ans('hollow', 'solid', { '50 cm': 'length', '3 cm': 'wall' }), ['50 cm', '3 cm']);
    expect(unknown?.open).toBe('one');
  });

  it('each role counts once, the first mention wins', () => {
    const v = volumeFromAnswers(
      ans('cube', 'one', { '50 cm': 'length', '80 cm': 'length' }),
      ['50 cm', '80 cm'],
    );
    near(v?.volume, 0.125);
  });

  it('a role for a measurement of the wrong kind is ignored', () => {
    // "25 m²" as a length and "2 cm" as an area make no sense; nothing is left for a slab.
    expect(volumeFromAnswers(ans('slab', 'one', { '25 m²': 'length', '2 cm': 'area' }), ['25 m²', '2 cm'])).toBeNull();
  });

  it('not enough information → null, and resolveVolume falls back to the text parser', () => {
    const a = ans('hollow', 'one', { '90 cm': 'length' }); // no wall thickness
    expect(volumeFromAnswers(a, ['90 cm'])).toBeNull();
    expect(volumeFromAnswers(ans('unknown', 'one', { '90 cm': 'length' }), ['90 cm'])).toBeNull();
    expect(volumeFromAnswers({}, ['90 cm'])).toBeNull();
    expect(resolveVolume('Terrasse hinterm Haus', {}, [], { defaultVolume: 1 }).source).toBe('default');
  });

  it('resolveVolume prefers Laya over the text and uses the text when Laya is not enough', () => {
    const laya = resolveVolume('Würfel 50 cm', ans('cube', 'one', { '50 cm': 'length' }), ['50 cm']);
    // 0,125 m³ rounds to 0,13 above 0,1 m³.
    expect(laya).toMatchObject({ source: 'laya', volume: 0.13 });
    const text = resolveVolume('Fundament 3x2 m, 20 cm dick', {}, ['3x2 m', '20 cm']);
    expect(text).toMatchObject({ source: 'dimensions', volume: 1.2 });
    expect(resolveVolume('Blumenkübel', {}, [], { defaultVolume: 0.01 })).toEqual({ volume: 0.01, source: 'default' });
  });
});

describe('wallFromAnswers', () => {
  it('returns the length Laya calls the wall, in metres', () => {
    expect(wallFromAnswers({ 'role:2 cm': { choice: 'wall' } }, ['40x40x40 cm', '2 cm'])).toBe(0.02);
  });

  it('is null without a wall role, or when the wall is not a length', () => {
    expect(wallFromAnswers({ 'role:2 cm': { choice: 'height' } }, ['2 cm'])).toBeNull();
    expect(wallFromAnswers({ 'role:2 stück': { choice: 'wall' } }, ['2 stück'])).toBeNull();
    expect(wallFromAnswers({}, [])).toBeNull();
  });
});

describe('walls given as length, height and thickness', () => {
  it('uses the thickness as the width: 8 m × 2,5 m × 24 cm = 4,8 m³', () => {
    const answers = {
      shape: { choice: 'slab' },
      'role:8 m': { choice: 'length' },
      'role:2,5 m': { choice: 'height' },
      'role:24 cm': { choice: 'thickness' },
    };
    expect(volumeFromAnswers(answers, ['8 m', '2,5 m', '24 cm'])?.volume).toBe(4.8);
  });

  it('a slab with length, width and thickness keeps the thickness as its height', () => {
    const answers = { shape: { choice: 'slab' }, 'role:6 m': { choice: 'length' }, 'role:3 m': { choice: 'width' }, 'role:15 cm': { choice: 'thickness' } };
    expect(volumeFromAnswers(answers, ['6 m', '3 m', '15 cm'])?.volume).toBe(2.7);
  });
});
