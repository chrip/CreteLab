// How much concrete a description asks for. Laya decides the shape and what each
// measurement means (a role per candidate from the API); fixed formulas turn that into m³.
// A regex parser covers descriptions Laya's answers are not enough for.
import { roundVolume, volumeBreakdown, type Dimensions, type OpenSides, type Shape, type VolumeBreakdown } from './geometry';
import type { Answers } from './answers';

const UNIT_TO_M: Record<string, number> = { mm: 0.001, cm: 0.01, dm: 0.1, m: 1 };
const num = (s: string) => parseFloat(s.replace(',', '.'));

export type VolumeSource = 'laya' | 'volume' | 'dimensions' | 'hollow' | 'default';

export interface VolumeResult {
  /** m³ */
  volume: number;
  source: VolumeSource;
  /** The text the volume was read from, for the note under the result. */
  match?: string;
  shape?: Shape;
  /** Wall thickness in m for hollow pieces. */
  wall?: number;
  open?: OpenSides;
  count?: number;
  /** The dimensions the volume was computed from (for pre-filling a form). */
  dimensions?: Dimensions;
  /** The solids behind the volume, to show how it was calculated. */
  breakdown?: VolumeBreakdown;
  /** Sizes the text did not give and were assumed (m), shown so the user can correct them. */
  assumed?: Assumed;
}

export type Assumed = Partial<Record<'length' | 'width' | 'height' | 'wall', number>>;

/** Wall thickness assumed for a vessel without one: fine mortar is cast thin, site concrete not. */
export const ASSUMED_WALL_M = { fineMortar: 0.02, concrete: 0.05 } as const;

/** A volume computed from a shape, with everything needed to explain it. */
function fromShape(shape: Shape, d: Dimensions, source: VolumeSource, match: string, assumed: Assumed = {}): VolumeResult | null {
  const breakdown = volumeBreakdown(shape, d);
  if (!breakdown) return null;
  return {
    volume: roundVolume(breakdown.volume), source, match, shape, dimensions: d, breakdown,
    wall: d.wall, open: shape === 'hollow' ? (d.open ?? 'one') : undefined, count: breakdown.count,
    ...(Object.keys(assumed).length ? { assumed } : {}),
  };
}

// ── Candidates from the API ("90 cm", "3x2 m", "12 zaunpfosten") ────────────────────────

export type Candidate =
  | { kind: 'dims'; size: number[] }
  | { kind: 'length' | 'area' | 'volume' | 'count'; value: number };

/** Read a measurement candidate (services/api measurements.py) back into numbers. */
export function parseCandidate(candidate: string): Candidate | null {
  const [value = '', unitRaw = ''] = candidate.replace(/ #\d+$/, '').split(' ');
  const unit = unitRaw.toLowerCase();
  if (value.includes('x')) {
    const factor = UNIT_TO_M[unit];
    return factor ? { kind: 'dims', size: value.split('x').map((v) => num(v) * factor) } : null;
  }
  const n = num(value);
  if (!Number.isFinite(n)) return null;
  const factor = UNIT_TO_M[unit];
  if (factor) return { kind: 'length', value: n * factor };
  if (['m²', 'm2', 'qm'].includes(unit)) return { kind: 'area', value: n };
  if (['m³', 'm3', 'cbm', 'kubik'].includes(unit)) return { kind: 'volume', value: n };
  if (['l', 'liter', 'litre'].includes(unit)) return { kind: 'volume', value: n / 1000 };
  return { kind: 'count', value: n };
}

const LENGTH_ROLES = ['length', 'width', 'height', 'diameter', 'wall', 'thickness'] as const;
type Role = (typeof LENGTH_ROLES)[number] | 'area' | 'volume' | 'count';

/** Wall thickness in m from Laya's roles, or null. */
export function wallFromAnswers(answers: Answers, candidates: readonly string[]): number | null {
  for (const c of candidates) {
    const p = parseCandidate(c);
    if (p?.kind === 'length' && answers[`role:${c}`]?.choice === 'wall') return p.value;
  }
  return null;
}

/** Each role once, first mention wins; a role only for a measurement of its kind. */
function rolesFromAnswers(answers: Answers, candidates: readonly string[]) {
  const roles: Partial<Record<Role, number>> = {};
  let dims: number[] | null = null;
  for (const c of candidates) {
    const p = parseCandidate(c);
    if (!p) continue;
    if (p.kind === 'dims') {
      dims ??= p.size;
      continue;
    }
    const role = answers[`role:${c}`]?.choice as Role | 'other' | undefined;
    if (!role || role === 'other' || roles[role] !== undefined) continue;
    const kindFits =
      role === 'area' || role === 'volume' || role === 'count'
        ? p.kind === role
        : p.kind === 'length';
    if (!kindFits) continue;
    // "2 Säcke Fertigbeton" is how much mix is bought, not how many pieces are cast.
    if (role === 'count' && /säck|sack|bag/.test(c)) continue;
    roles[role] = p.value;
  }
  return { roles, dims };
}

const SOLID = /massiv|vollmaterial|\bsolid\b/;

export interface VolumeOptions {
  /** The description, for words the model may miss ("Würfel", "massiv"). */
  text?: string;
  /** Wall thickness to assume for a vessel that gives none; none assumed when absent. */
  assumedWall?: number;
}

/**
 * Volume from Laya's shape and roles, or null when the answers are not enough.
 * Missing sizes are filled the way a person would read the text: a block, cube or vessel
 * with one edge has equal sides, a round vessel is as high as it is wide, and a vessel
 * without a wall gets `assumedWall`. Every such guess is listed in `assumed`.
 */
export function volumeFromAnswers(answers: Answers, candidates: readonly string[], opts: VolumeOptions = {}): VolumeResult | null {
  const { roles: r, dims } = rolesFromAnswers(answers, candidates);
  if (r.volume) return { volume: roundVolume(r.volume), source: 'laya', match: candidates.join(' · ') };

  const t = (opts.text ?? '').toLowerCase();
  const open = answers.open_sides?.choice;
  let shape = answers.shape?.choice as Shape | 'unknown' | undefined;
  // A wall thickness means a hollow piece, whatever shape was answered.
  if (r.wall && !['hollow', 'ring', 'bowl'].includes(shape ?? '')) shape = 'hollow';
  // "massiv" is not hollow, and "Würfel" says the shape outright.
  if (!r.wall && (open === 'solid' || SOLID.test(t)) && shape === 'hollow') shape = 'block';
  if (!r.wall && CUBE.test(t) && (shape === 'block' || shape === 'unknown' || shape === undefined)) shape = 'cube';
  if (!shape || shape === 'unknown') return null;

  // A wall gives length, height and thickness: the thickness is its width.
  const wallLike = !dims && r.height !== undefined && r.thickness !== undefined && r.width === undefined;
  const d: Dimensions = {
    length: dims?.[0] ?? r.length,
    width: dims?.[1] ?? r.width ?? (wallLike ? r.thickness : undefined),
    height: dims?.[2] ?? r.height ?? r.thickness,
    diameter: r.diameter,
    wall: r.wall,
    area: r.area,
    open: open === 'none' || open === 'both' ? open : 'one',
    count: r.count,
  };
  if (shape === 'slab' && r.thickness && !dims?.[2] && !wallLike) d.height = r.thickness;

  const assumed: Assumed = {};
  if (shape === 'block' || shape === 'hollow') {
    const edges = [d.length, d.width, d.height].filter((v): v is number => v !== undefined);
    if (d.diameter === undefined && edges.length === 1) {
      for (const k of ['length', 'width', 'height'] as const) {
        if (d[k] === undefined) d[k] = assumed[k] = edges[0];
      }
    } else if (d.diameter !== undefined && d.height === undefined && d.length === undefined) {
      d.height = assumed.height = d.diameter;
    }
  }
  if (shape === 'hollow' && !d.wall && opts.assumedWall) d.wall = assumed.wall = opts.assumedWall;
  return fromShape(shape, d, 'laya', candidates.join(' · '), assumed);
}

// ── Plain-text fallback ─────────────────────────────────────────────────────────────────

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const LEN = String.raw`(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|m)\b`;
const DIMS_RE = new RegExp(
  `${NUM}\\s*(mm|cm|m)?\\s*[x×*]\\s*${NUM}\\s*(mm|cm|m)?(?:\\s*[x×*]\\s*${NUM}\\s*(mm|cm|m)?)?(?![a-zäöüß\\d])`,
);

/** "3x2 m", "40x40x80 cm", "40 cm x 40 cm". Without a unit, values from 10 up are cm. */
function parseDims(t: string) {
  const m = t.match(DIMS_RE);
  if (!m) return null;
  const values = [m[1], m[3], m[5]].filter((v): v is string => Boolean(v)).map(num);
  const unit = m[6] || m[4] || m[2] || (Math.min(...values) >= 10 ? 'cm' : 'm');
  return { size: values.map((v) => v * UNIT_TO_M[unit]!), match: m[0].trim() };
}

// Wall thickness in the orders people write it. The bare word "Wand" only with mm/cm, so
// "Kellerwand 3 m hoch" is not read as a wall thickness.
const WALL_PATTERNS = [
  new RegExp(String.raw`(?:wand(?:stärke|staerke|dicke|icke)|materialstärke|wandung|wall\s*thickness)\s*(?:von\s*|of\s*)?` + LEN),
  new RegExp(String.raw`\b(?:wand|wall)\s*(?:von\s*|of\s*)?(\d+(?:[.,]\d+)?)\s*(mm|cm)\b`),
  new RegExp(LEN + String.raw`\s*(?:wand|wände|walls?)\b`),
];
const CUBE = /würfel|wuerfel|kubus|kubisch|cubisch|\bcube\b|\bcubic\b/;
const CLOSED = /geschlossen|\bclosed\b|rundum zu/;
const BOTH_OPEN = /\brohr|röhre|\bring\b|ohne boden|bottomless|\btube\b|\bpipe\b/;

function findWall(t: string) {
  for (const re of WALL_PATTERNS) {
    const m = t.match(re);
    if (m) return { text: m[0], meters: num(m[1]!) * UNIT_TO_M[m[2]!]! };
  }
  return null;
}

/** A DIY piece with a wall thickness is hollow, open on one side unless the text says otherwise. */
function parseHollowBody(t: string): VolumeResult | null {
  const wall = findWall(t);
  if (!wall) return null;
  let outer: { size: number[]; match: string } | null = null;
  const dims = parseDims(t);
  if (dims?.size.length === 3) {
    outer = dims;
  } else if (CUBE.test(t)) {
    // The edge: the largest length in the text that is not the wall thickness.
    const lengths = [...t.replace(wall.text, ' ').matchAll(new RegExp(LEN, 'g'))];
    const meters = (m: RegExpMatchArray) => num(m[1]!) * UNIT_TO_M[m[2]!]!;
    const best = lengths.reduce<RegExpMatchArray | null>((a, b) => (!a || meters(b) > meters(a) ? b : a), null);
    if (best) outer = { size: [meters(best), meters(best), meters(best)], match: best[0] };
  }
  if (!outer) return null;
  const open: OpenSides = CLOSED.test(t) ? 'none' : BOTH_OPEN.test(t) ? 'both' : 'one';
  const [length, width, height] = outer.size;
  return fromShape('hollow', { length, width, height, wall: wall.meters, open }, 'hollow', `${outer.match} · ${wall.text}`);
}

/**
 * Find the volume in plain text: volumes ("2 m³", "halber Kubik", "500 Liter"), hollow
 * bodies with a wall thickness, dimensions ("40x40x80 cm", "3x2 m, 20 cm dick") and areas
 * with a thickness ("25 m², 15 cm stark"). Falls back to `defaultVolume`.
 */
export function parseVolume(text: string, { defaultVolume = 1 } = {}): VolumeResult {
  const t = text.toLowerCase();

  const vol = t.match(new RegExp(`${NUM}\\s*(m³|m3|cbm|kubikmeter|kubik|cubic met(?:er|re)s?)`));
  if (vol) return { volume: roundVolume(num(vol[1]!)), source: 'volume', match: vol[0] };
  if (/halbe[rn]?\s+kubik|half a cubic/.test(t)) return { volume: 0.5, source: 'volume', match: 'halber Kubik' };
  const litres = t.match(new RegExp(`${NUM}\\s*(l|liter|litre|liters|litres)\\b`));
  if (litres) return { volume: roundVolume(num(litres[1]!) / 1000), source: 'volume', match: litres[0] };

  const hollow = parseHollowBody(t);
  if (hollow) return hollow;

  // "Würfel mit 90 cm Seitenlänge": a cube needs one edge only.
  const lengths = [...t.matchAll(new RegExp(LEN, 'g'))];
  if (CUBE.test(t) && lengths.length === 1) {
    const a = num(lengths[0]![1]!) * UNIT_TO_M[lengths[0]![2]!]!;
    return fromShape('cube', { length: a }, 'dimensions', lengths[0]![0])!;
  }

  const thickness = t.match(new RegExp(
    `${NUM}\\s*(mm|cm|dm|m)\\s*(?:dick|stark|tief|hoch|höhe|dicke|thick|deep|high|thickness|depth)` +
    `|(?:dicke|stärke|tiefe|höhe|thickness|depth)\\s*(?:von\\s*|of\\s*)?${NUM}\\s*(mm|cm|dm|m)`,
  ));
  const thicknessM = thickness
    ? thickness[1]
      ? num(thickness[1]) * UNIT_TO_M[thickness[2]!]!
      : num(thickness[3]!) * UNIT_TO_M[thickness[4]!]!
    : null;

  const dims = parseDims(t);
  if (dims) {
    const [a = 0, b = 0, c] = dims.size;
    if (c !== undefined) return fromShape('block', { length: a, width: b, height: c }, 'dimensions', dims.match)!;
    if (thicknessM) return fromShape('slab', { length: a, width: b, height: thicknessM }, 'dimensions', `${dims.match} · ${thickness![0]}`)!;
  }

  const area = t.match(new RegExp(`${NUM}\\s*(m²|m2|qm|quadratmeter|square met(?:er|re)s?|sqm)`));
  if (area && thicknessM) {
    return fromShape('slab', { area: num(area[1]!), height: thicknessM }, 'dimensions', `${area[0]} · ${thickness![0]}`)!;
  }
  return { volume: defaultVolume, source: 'default' };
}

/** Laya's shape and roles where they are enough, the text parser otherwise. */
export function resolveVolume(
  text: string,
  answers: Answers,
  candidates: readonly string[],
  { defaultVolume = 1, assumedWall }: { defaultVolume?: number; assumedWall?: number } = {},
): VolumeResult {
  return volumeFromAnswers(answers, candidates, { text, assumedWall }) ?? parseVolume(text, { defaultVolume });
}
