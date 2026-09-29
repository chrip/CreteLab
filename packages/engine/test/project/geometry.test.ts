import { describe, expect, it } from 'vitest';
import { roundVolume, shapeVolume, type Dimensions, type Shape } from '../../src/project/geometry';

const circle = (d: number) => (Math.PI / 4) * d * d;

describe('shapeVolume', () => {
  it.each<[string, Shape, Dimensions, number]>([
    // Slab given as area and thickness: 25 m² × 0,15 m.
    ['slab by area', 'slab', { area: 25, height: 0.15 }, 3.75],
    // Slab given as length × width × thickness: 4 × 3 × 0,12.
    ['slab by L×W×H', 'slab', { length: 4, width: 3, height: 0.12 }, 1.44],
    // The area wins over L×W when both are given.
    ['slab area before L×W', 'slab', { area: 10, length: 4, width: 3, height: 0.1 }, 1],
    ['block', 'block', { length: 0.3, width: 0.3, height: 0.8 }, 0.072],
    // A block with a diameter is round: π/4 · 0,3² · 0,6.
    ['round block by height', 'block', { diameter: 0.3, height: 0.6 }, circle(0.3) * 0.6],
    ['round block by length', 'block', { diameter: 0.3, length: 0.6 }, circle(0.3) * 0.6],
    ['cube by length', 'cube', { length: 0.5 }, 0.125],
    ['cube by width', 'cube', { width: 0.5 }, 0.125],
    ['cube by height', 'cube', { height: 0.5 }, 0.125],
    // The first given edge wins (length before width before height).
    ['cube with several edges', 'cube', { length: 0.2, width: 0.5 }, 0.008],
    ['cylinder', 'cylinder', { diameter: 0.2, height: 1 }, circle(0.2)],
    ['cylinder by length', 'cylinder', { diameter: 0.2, length: 2 }, 2 * circle(0.2)],
    // Hollow box 40×40×40 cm, 2 cm wall. One side open (default): the inner height loses one wall.
    ['hollow box, default open one', 'hollow', { length: 0.4, width: 0.4, height: 0.4, wall: 0.02 }, 0.064 - 0.36 * 0.36 * 0.38],
    ['hollow box, open one', 'hollow', { length: 0.4, width: 0.4, height: 0.4, wall: 0.02, open: 'one' }, 0.064 - 0.36 * 0.36 * 0.38],
    // Closed: bottom and lid.
    ['hollow box, open none', 'hollow', { length: 0.4, width: 0.4, height: 0.4, wall: 0.02, open: 'none' }, 0.064 - 0.36 ** 3],
    // Open at both ends: a tube, the inner height is the full height.
    ['hollow box, open both', 'hollow', { length: 0.4, width: 0.4, height: 0.4, wall: 0.02, open: 'both' }, 0.064 - 0.36 * 0.36 * 0.4],
    // Round pot Ø 40 cm, 35 cm high, 2,5 cm wall, one side open.
    ['hollow cylinder', 'hollow', { diameter: 0.4, height: 0.35, wall: 0.025 }, circle(0.4) * 0.35 - circle(0.35) * 0.325],
    ['hollow cylinder, closed', 'hollow', { diameter: 0.4, height: 0.35, wall: 0.025, open: 'none' }, circle(0.4) * 0.35 - circle(0.35) * 0.3],
    // A hollow cube may give only its edge: 0,9³ − 0,86 · 0,86 · 0,88.
    ['hollow cube by its edge', 'hollow', { length: 0.9, wall: 0.02 }, 0.9 ** 3 - 0.86 * 0.86 * 0.88],
    ['hollow cube by its height', 'hollow', { height: 0.9, wall: 0.02 }, 0.9 ** 3 - 0.86 * 0.86 * 0.88],
    // Walls of half the edge or more leave no cavity: the body is solid.
    ['hollow body with a wall of half the edge', 'hollow', { length: 0.04, width: 0.04, height: 0.04, wall: 0.02 }, 0.04 ** 3],
    // Pipe 1 m long, Ø 30 cm, 4 cm wall.
    ['round ring', 'ring', { diameter: 0.3, wall: 0.04, length: 1 }, circle(0.3) - circle(0.22)],
    ['round ring by height', 'ring', { diameter: 0.3, wall: 0.04, height: 0.5 }, 0.5 * (circle(0.3) - circle(0.22))],
    // Concrete ring 60×60×30 cm, 4 cm wall: 0,3 · (0,36 − 0,52²).
    ['rectangular ring', 'ring', { length: 0.6, width: 0.6, height: 0.3, wall: 0.04 }, 0.3 * (0.36 - 0.52 ** 2)],
    // Bowl Ø 30 cm, 1,5 cm wall: half a hollow sphere, 2/3 π (R³ − r³).
    ['bowl', 'bowl', { diameter: 0.3, wall: 0.015 }, (2 / 3) * Math.PI * (0.15 ** 3 - 0.135 ** 3)],
    // A wall thicker than the radius gives a solid half sphere.
    ['solid bowl', 'bowl', { diameter: 0.1, wall: 0.1 }, (2 / 3) * Math.PI * 0.05 ** 3],
  ])('%s', (_name, shape, d, expected) => {
    expect(shapeVolume(shape, d)).toBeCloseTo(expected, 12);
  });

  it.each<[Shape, Dimensions]>([
    ['block', { length: 0.3, width: 0.3, height: 0.8 }],
    ['cube', { length: 0.5 }],
    ['cylinder', { diameter: 0.2, height: 1 }],
    ['hollow', { length: 0.4, width: 0.4, height: 0.4, wall: 0.02 }],
    ['ring', { diameter: 0.3, wall: 0.04, length: 1 }],
    ['bowl', { diameter: 0.3, wall: 0.015 }],
    ['slab', { area: 25, height: 0.15 }],
  ])('count multiplies the %s', (shape, d) => {
    const one = shapeVolume(shape, d)!;
    expect(shapeVolume(shape, { ...d, count: 12 })).toBeCloseTo(12 * one, 12);
  });

  it('a count of zero or less counts as one piece', () => {
    expect(shapeVolume('cube', { length: 0.5, count: 0 })).toBe(0.125);
    expect(shapeVolume('cube', { length: 0.5, count: -3 })).toBe(0.125);
  });

  it.each<[string, Shape, Dimensions]>([
    ['slab without a thickness', 'slab', { area: 25 }],
    ['slab with only a length and a thickness', 'slab', { length: 4, height: 0.12 }],
    ['block with two dimensions', 'block', { length: 0.3, width: 0.3 }],
    ['block with only a diameter', 'block', { diameter: 0.3 }],
    ['cube without an edge', 'cube', { diameter: 0.5 }],
    ['cylinder without a height', 'cylinder', { diameter: 0.2 }],
    ['cylinder without a diameter', 'cylinder', { length: 0.2, width: 0.2, height: 1 }],
    ['hollow body without a wall', 'hollow', { length: 0.4, width: 0.4, height: 0.4 }],
    // Two of three edges is not a cube, and not a box either.
    ['hollow box with two edges', 'hollow', { length: 0.4, width: 0.4, wall: 0.02 }],
    ['ring without a wall', 'ring', { diameter: 0.3, length: 1 }],
    ['ring without a height', 'ring', { diameter: 0.3, wall: 0.04 }],
    ['bowl without a wall', 'bowl', { diameter: 0.3 }],
    ['bowl without a diameter', 'bowl', { wall: 0.015, length: 0.3 }],
    // Zero is not a dimension.
    ['cube with a zero edge', 'cube', { length: 0 }],
    ['nothing at all', 'block', {}],
  ])('%s → null', (_name, shape, d) => {
    expect(shapeVolume(shape, d)).toBeNull();
  });
});

describe('roundVolume', () => {
  it.each([
    // Below 0,1 m³ four decimals (litre precision for DIY pieces).
    [0.078152, 0.0782],
    [0.0216, 0.0216],
    [0.01475, 0.0148],
    // From 0,1 m³ two decimals.
    [0.1, 0.1],
    [0.128, 0.13],
    [1.2345, 1.23],
    [3.75, 3.75],
    // Just below 0,1 rounds up to 0,1 with four decimals.
    [0.099996, 0.1],
    // Never zero: a tenth of a litre at least.
    [0.00001, 0.0001],
    [0, 0.0001],
  ])('%s m³ → %s m³', (v, expected) => {
    expect(roundVolume(v)).toBe(expected);
  });
});
