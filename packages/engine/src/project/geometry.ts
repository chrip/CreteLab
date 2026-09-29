// Volume formulas for the shapes Laya recognises and the fine concrete page offers.

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

/** A simple solid; every shape is one of these, minus an inner one for hollow pieces. */
export type Solid =
  | { kind: 'box'; length: number; width: number; height: number }
  | { kind: 'area'; area: number; height: number }
  | { kind: 'cylinder'; diameter: number; height: number }
  | { kind: 'hemisphere'; diameter: number };

/** How a volume is made up, so the UI can show the calculation next to the result. */
export interface VolumeBreakdown {
  outer: Solid;
  /** The hollow space taken away, if any. */
  inner: Solid | null;
  count: number;
  /** m³, all pieces */
  volume: number;
}

const positive = (v: number) => Math.max(0, v);

export function solidVolume(s: Solid): number {
  switch (s.kind) {
    case 'box':
      return s.length * s.width * s.height;
    case 'area':
      return s.area * s.height;
    case 'cylinder':
      return (Math.PI / 4) * s.diameter ** 2 * s.height;
    case 'hemisphere':
      return (Math.PI / 12) * s.diameter ** 3;
  }
}

function solids(shape: Shape, d: Dimensions): [Solid, Solid | null] | null {
  const { length: L, width: W, height: H, diameter: D, wall: t, area } = d;
  const box = (length: number, width: number, height: number): Solid => ({ kind: 'box', length, width, height });
  const cylinder = (diameter: number, height: number): Solid => ({ kind: 'cylinder', diameter, height });
  switch (shape) {
    case 'slab':
      if (area && H) return [{ kind: 'area', area, height: H }, null];
      if (L && W && H) return [box(L, W, H), null];
      return null;
    case 'block':
      if (L && W && H) return [box(L, W, H), null];
      if (D && (H || L)) return [cylinder(D, (H || L)!), null]; // a block with a diameter is round
      return null;
    case 'cube': {
      const a = L ?? W ?? H;
      return a ? [box(a, a, a), null] : null;
    }
    case 'cylinder':
      return D && (H || L) ? [cylinder(D, (H || L)!), null] : null;
    case 'hollow': {
      if (!t) return null;
      // The open side is taken along the height.
      const closedFaces = d.open === 'none' ? 2 : d.open === 'both' ? 0 : 1;
      const innerHeight = (h: number) => positive(h - closedFaces * t);
      if (D && (H || L)) {
        const h = (H || L)!;
        return [cylinder(D, h), cylinder(positive(D - 2 * t), innerHeight(h))];
      }
      // A hollow cube may give only its edge.
      const given = [L, W, H].filter(Boolean);
      const a = given.length === 1 ? given[0] : undefined;
      const [l, w, h] = [L ?? a, W ?? a, H ?? a];
      return l && w && h ? [box(l, w, h), box(positive(l - 2 * t), positive(w - 2 * t), innerHeight(h))] : null;
    }
    case 'ring':
      if (D && t && (H || L)) {
        const h = (H || L)!;
        return [cylinder(D, h), cylinder(positive(D - 2 * t), h)];
      }
      if (L && W && H && t) return [box(L, W, H), box(positive(L - 2 * t), positive(W - 2 * t), H)];
      return null;
    case 'bowl':
      // Half a hollow sphere.
      return D && t ? [{ kind: 'hemisphere', diameter: D }, { kind: 'hemisphere', diameter: positive(D - 2 * t) }] : null;
  }
}

/** The solids behind a volume, or null when the dimensions are not enough for the shape. */
export function volumeBreakdown(shape: Shape, d: Dimensions): VolumeBreakdown | null {
  const parts = solids(shape, d);
  if (!parts) return null;
  const [outer, inner] = parts;
  const count = d.count && d.count > 0 ? d.count : 1;
  const volume = (solidVolume(outer) - (inner ? solidVolume(inner) : 0)) * count;
  return volume > 0 ? { outer, inner, count, volume } : null;
}

/** Concrete volume in m³, or null when the dimensions are not enough for the shape. */
export function shapeVolume(shape: Shape, d: Dimensions): number | null {
  return volumeBreakdown(shape, d)?.volume ?? null;
}

/** Litre precision below 0,1 m³ (DIY pieces), two decimals above. */
export function roundVolume(v: number): number {
  const digits = v < 0.1 ? 4 : 2;
  return Math.max(0.0001, Math.round(v * 10 ** digits) / 10 ** digits);
}
