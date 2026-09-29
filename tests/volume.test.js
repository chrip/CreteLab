import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCandidate, volumeFromAnswers, resolveVolume } from '../js/lib/volume.js';

// Laya's answers as the server returns them: shape, open_sides and role:<candidate>
const ans = (shape, open, roles) => ({
    shape: { choice: shape }, open_sides: { choice: open },
    ...Object.fromEntries(Object.entries(roles).map(([c, r]) => [`role:${c}`, { choice: r }]))
});
const near = (a, e, what) => assert.ok(Math.abs(a - e) < 1e-4, `${what}: expected ${e}, got ${a}`);

describe('parseCandidate', () => {
    it('reads the candidate texts of describe/measurements.py', () => {
        assert.deepStrictEqual(parseCandidate('90 cm'), { kind: 'length', value: 0.9 });
        assert.deepStrictEqual(parseCandidate('2,5 cm'), { kind: 'length', value: 0.025 });
        assert.deepStrictEqual(parseCandidate('40 cm #2'), { kind: 'length', value: 0.4 });
        assert.deepStrictEqual(parseCandidate('30x30x80 cm').kind, 'dims');
        assert.deepStrictEqual(parseCandidate('25 m²'), { kind: 'area', value: 25 });
        assert.deepStrictEqual(parseCandidate('2 kubik'), { kind: 'volume', value: 2 });
        assert.deepStrictEqual(parseCandidate('500 liter'), { kind: 'volume', value: 0.5 });
        assert.deepStrictEqual(parseCandidate('12 zaunpfosten'), { kind: 'count', value: 12 });
    });
});

describe('volume from shape and roles', () => {
    it('hollow seat cube, 90 cm edge, 2 cm wall, one side open: 0,9³ − 0,86·0,86·0,88', () => {
        const v = volumeFromAnswers(ans('hollow', 'one', { '90 cm': 'length', '2 cm': 'wall' }), ['90 cm', '2 cm']);
        near(v.volume, 0.9 ** 3 - 0.86 * 0.86 * 0.88, 'seat cube');
    });

    it('round pot Ø 40 cm, 35 cm high, 2,5 cm wall: π/4·(0,4²·0,35 − 0,35²·0,325)', () => {
        const v = volumeFromAnswers(ans('hollow', 'one', { '40 cm': 'diameter', '35 cm': 'height', '2,5 cm': 'wall' }), ['40 cm', '35 cm', '2,5 cm']);
        near(v.volume, Math.PI / 4 * (0.16 * 0.35 - 0.35 ** 2 * 0.325), 'round pot');
    });

    it('12 post holes 30x30x80 cm: 12 × 0,072', () => {
        const v = volumeFromAnswers(ans('block', 'solid', { '12 zaunpfosten': 'count' }), ['12 zaunpfosten', '30x30x80 cm']);
        near(v.volume, 12 * 0.3 * 0.3 * 0.8, 'post holes');
    });

    it('6 point foundations 40 cm x 40 cm, 80 cm deep', () => {
        const v = volumeFromAnswers(ans('block', 'solid', { '6 punktfundamente': 'count', '80 cm': 'height' }), ['6 punktfundamente', '40x40 cm', '80 cm']);
        near(v.volume, 6 * 0.4 * 0.4 * 0.8, 'point foundations');
    });

    it('pipe 1 m long, Ø 30 cm, 4 cm wall: π/4·(0,3² − 0,22²)·1', () => {
        const v = volumeFromAnswers(ans('ring', 'both', { '1 m': 'length', '30 cm': 'diameter', '4 cm': 'wall' }), ['1 m', '30 cm', '4 cm']);
        near(v.volume, Math.PI / 4 * (0.09 - 0.22 ** 2), 'pipe');
    });

    it('bowl Ø 30 cm, 1,5 cm wall: half-sphere shell', () => {
        const v = volumeFromAnswers(ans('bowl', 'one', { '30 cm': 'diameter', '1,5 cm': 'wall' }), ['30 cm', '1,5 cm']);
        near(v.volume, 2 / 3 * Math.PI * (0.15 ** 3 - 0.135 ** 3), 'bowl');
    });

    it('driveway 25 m², 15 cm: area × thickness', () => {
        const v = volumeFromAnswers(ans('slab', 'solid', { '25 m²': 'area', '15 cm': 'thickness' }), ['25 m²', '15 cm']);
        near(v.volume, 3.75, 'driveway');
    });

    it('a number of bags never multiplies the piece: "2 Säcken … 30x30x60 cm" stays 54 l', () => {
        const v = volumeFromAnswers(ans('block', 'solid', { '2 säcken': 'count' }), ['2 säcken', '30x30x60 cm']);
        near(v.volume, 0.3 * 0.3 * 0.6, 'letterbox base');
    });

    it('a "block" given by diameter and depth is round: 3 holes Ø 30 cm × 60 cm', () => {
        const v = volumeFromAnswers(ans('block', 'solid', { '3 holes': 'count', '30 cm': 'diameter', '60 cm': 'height' }), ['3 holes', '30 cm', '60 cm']);
        near(v.volume, 3 * Math.PI / 4 * 0.09 * 0.6, 'post holes');
    });

    it('a wall thickness makes it hollow even if Laya says "block"', () => {
        const v = volumeFromAnswers(ans('block', 'one', { '90 cm': 'length', '2 cm': 'wall' }), ['90 cm', '2 cm']);
        near(v.volume, 0.9 ** 3 - 0.86 * 0.86 * 0.88, 'seat cube as block');
    });

    it('a stated amount wins: "2 Kubik"', () => {
        assert.strictEqual(volumeFromAnswers(ans('hollow', 'one', { '2 kubik': 'volume' }), ['2 kubik']).volume, 2);
    });

    it('not enough information → null, and resolveVolume falls back to the text parser', () => {
        const a = ans('hollow', 'one', { '90 cm': 'length' });    // no wall thickness
        assert.strictEqual(volumeFromAnswers(a, ['90 cm']), null);
        assert.strictEqual(resolveVolume('Terrasse hinterm Haus', {}, [], { defaultVolume: 1 }).source, 'default');
    });
});
