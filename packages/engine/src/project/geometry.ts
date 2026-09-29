// Volume formulas for the shapes Laya recognises and the decor workshop offers.

export const SHAPES = ['slab', 'block', 'cube', 'cylinder', 'hollow', 'ring', 'bowl'] as const;
export type Shape = (typeof SHAPES)[number];

/** Open faces of a hollow body. Cast pieces need one to pour and demould, so 'one' is the default. */
export type OpenSides = 'one' | 'none' | 'both';

export interface Dimensions {
  /** Metres. For a slab `height` is its thickness. */
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
  /** Wall thickness of hollow bodies, rings and bowls. */
  wall?: number;
  /** Area in m², for slabs given as "25 m², 15 cm". */
  area?: number;
  open?: OpenSides;
  /** Pieces of the same size. */
  count?: number;
}

const circle = (d: number) => (Math.PI / 4) * d * d;
const positive = (v: number) => Math.max(0, v);

/**
 * Concrete volume in m³, or null when the dimensions are not enough for the shape.
 * Hollow bodies lose their inner volume; the open side is taken along the height.
 */
export function shapeVolume(shape: Shape, d: Dimensions): number | null {
  const { length: L, width: W, height: H, diameter: D, wall: t, area } = d;
  const count = d.count && d.count > 0 ? d.count : 1;
  let v: number | null = null;
  switch (shape) {
    case 'slab':
      if (area && H) v = area * H;
      else if (L && W && H) v = L * W * H;
      break;
    case 'block':
      if (L && W && H) v = L * W * H;
      else if (D && (H || L)) v = circle(D) * (H || L)!; // a block with a diameter is round
      break;
    case 'cube': {
      const a = L ?? W ?? H;
      if (a) v = a ** 3;
      break;
    }
    case 'cylinder':
      if (D && (H || L)) v = circle(D) * (H || L)!;
      break;
    case 'hollow': {
      if (!t) break;
      const closedFaces = d.open === 'none' ? 2 : d.open === 'both' ? 0 : 1;
      const innerHeight = (h: number) => positive(h - closedFaces * t);
      if (D && (H || L)) {
        const h = (H || L)!;
        v = circle(D) * h - circle(positive(D - 2 * t)) * innerHeight(h);
      } else {
        // A hollow cube may give only its edge.
        const given = [L, W, H].filter(Boolean);
        const a = given.length === 1 ? given[0] : undefined;
        const [l, w, h] = [L ?? a, W ?? a, H ?? a];
        if (l && w && h) v = l * w * h - positive(l - 2 * t) * positive(w - 2 * t) * innerHeight(h);
      }
      break;
    }
    case 'ring':
      if (D && t && (H || L)) v = (circle(D) - circle(positive(D - 2 * t))) * (H || L)!;
      else if (L && W && H && t) v = H * (L * W - positive(L - 2 * t) * positive(W - 2 * t));
      break;
    case 'bowl':
      // Half a hollow sphere.
      if (D && t) {
        const R = D / 2;
        v = (2 / 3) * Math.PI * (R ** 3 - positive(R - t) ** 3);
      }
      break;
  }
  return v !== null && v > 0 ? v * count : null;
}

/** Litre precision below 0,1 m³ (DIY pieces), two decimals above. */
export function roundVolume(v: number): number {
  const digits = v < 0.1 ? 4 : 2;
  return Math.max(0.0001, Math.round(v * 10 ** digits) / 10 ** digits);
}
