// Page state in the URL. Every page can be bookmarked, shared and reloaded, and the
// browser's back button undoes a change. Defaults are left out to keep links short;
// unknown or broken values fall back to the defaults instead of breaking the page.
import {
  AGGREGATE_TYPES, BAG_MIXES, CEMENT_TYPE_NAMES, CONSISTENCY_CLASSES, DECOR_PRESETS, DEFAULT_MIX,
  EXPOSURE_CLASS_NAMES, PLASTICIZERS, SHAPES, SIEVE_LINE_NAMES, STRENGTH_CLASS_NAMES,
  type BagMixId, type BagOptions, type MixInput, type OpenSides, type Production, type Shape,
} from '@cretelab/engine';

export type Query = Record<string, string | null | (string | null)[] | undefined>;

const one = (q: Query, key: string): string | undefined => {
  const v = q[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s === null || s === undefined ? undefined : s;
};

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function number(value: string | undefined, fallback: number, min = 0, max = Infinity): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

const flag = (value: string | undefined) => value === '1';

/** Drops keys whose value is undefined, so defaults do not appear in the URL. */
function compact(q: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(q).filter((e): e is [string, string] => e[1] !== undefined));
}

const unlessDefault = <T>(value: T, fallback: T, encode: (v: T) => string = String) =>
  value === fallback ? undefined : encode(value);

// ── Component planner ───────────────────────────────────────────────────────────────────

export interface PlannerState {
  /** The description the plan came from. */
  q: string;
  /** m³ */
  volume: number;
  tab: Production;
  mix: MixInput;
}

export const PRODUCTIONS: readonly Production[] = ['bag', 'mix', 'order'];

export function decodePlanner(q: Query): PlannerState {
  const classes = (one(q, 'x') ?? '').split(',').filter((c) => (EXPOSURE_CLASS_NAMES as string[]).includes(c));
  const moisture = (one(q, 'mo') ?? '').split(',').map(Number);
  return {
    q: one(q, 'q') ?? '',
    volume: number(one(q, 'v'), 1, 0.0001, 10000),
    tab: oneOf(one(q, 'tab'), PRODUCTIONS, 'mix'),
    mix: {
      strengthClass: oneOf(one(q, 's'), STRENGTH_CLASS_NAMES, DEFAULT_MIX.strengthClass),
      exposureClasses: one(q, 'x') === undefined ? DEFAULT_MIX.exposureClasses : (classes as MixInput['exposureClasses']),
      sieveLine: oneOf(one(q, 'sl'), SIEVE_LINE_NAMES, DEFAULT_MIX.sieveLine),
      consistency: oneOf(one(q, 'c'), CONSISTENCY_CLASSES, DEFAULT_MIX.consistency),
      aggregate: oneOf(one(q, 'agg'), AGGREGATE_TYPES, DEFAULT_MIX.aggregate),
      cementType: oneOf(one(q, 'cem'), CEMENT_TYPE_NAMES, DEFAULT_MIX.cementType),
      margin: number(one(q, 'm'), DEFAULT_MIX.margin, 3, 12),
      plasticizer: oneOf(one(q, 'p'), PLASTICIZERS, DEFAULT_MIX.plasticizer),
      airPct: number(one(q, 'air'), 0, 0, 12),
      flyAshPct: number(one(q, 'fa'), 0, 0, 33),
      silicaFumePct: number(one(q, 'sf'), 0, 0, 11),
      waterproofingPct: number(one(q, 'wu'), 0, 0, 5),
      moisture: moisture.length === 3 && moisture.every((m) => Number.isFinite(m) && m >= 0 && m <= 20)
        ? (moisture as [number, number, number])
        : null,
    },
  };
}

export function encodePlanner(s: PlannerState): Record<string, string> {
  const m = s.mix;
  const d = DEFAULT_MIX;
  return compact({
    q: s.q || undefined,
    v: unlessDefault(Number(s.volume.toPrecision(6)), 1),
    tab: unlessDefault(s.tab, 'mix'),
    s: unlessDefault(m.strengthClass, d.strengthClass),
    x: unlessDefault(m.exposureClasses.join(','), d.exposureClasses.join(',')),
    sl: unlessDefault(m.sieveLine, d.sieveLine),
    c: unlessDefault(m.consistency, d.consistency),
    agg: unlessDefault(m.aggregate, d.aggregate),
    cem: unlessDefault(m.cementType, d.cementType),
    m: unlessDefault(m.margin, d.margin),
    p: unlessDefault(m.plasticizer, d.plasticizer),
    air: unlessDefault(m.airPct, 0),
    fa: unlessDefault(m.flyAshPct, 0),
    sf: unlessDefault(m.silicaFumePct, 0),
    wu: unlessDefault(m.waterproofingPct, 0),
    mo: m.moisture ? m.moisture.join(',') : undefined,
  });
}

// ── Fine concrete page ──────────────────────────────────────────────────────────────────────

export interface FineConcreteState {
  q: string;
  shape: Shape;
  /** Outer dimensions and wall thickness in cm, as DIY instructions give them. */
  length: number | null;
  width: number | null;
  height: number | null;
  diameter: number | null;
  wall: number | null;
  open: OpenSides;
  count: number;
  preset: string;
  /** Sizes filled in by assumption, until the user sets them. */
  assumed: FineConcreteField[];
  /** The piece holds water (a sink): dense mix and a sealed surface. */
  holdsWater: boolean;
}

export type FineConcreteField = 'length' | 'width' | 'height' | 'diameter' | 'wall';
const FIELDS: readonly FineConcreteField[] = ['length', 'width', 'height', 'diameter', 'wall'];

type DimensionKey = 'l' | 'b' | 'h' | 'd' | 't';

export function decodeFineConcrete(q: Query): FineConcreteState {
  const cm = (key: DimensionKey) => {
    const n = number(one(q, key), NaN, 0.01, 10000);
    return Number.isNaN(n) ? null : n;
  };
  return {
    q: one(q, 'q') ?? '',
    shape: oneOf(one(q, 'shape'), SHAPES, 'hollow'),
    length: cm('l'),
    width: cm('b'),
    height: cm('h'),
    diameter: cm('d'),
    wall: cm('t'),
    open: oneOf(one(q, 'open'), ['one', 'none', 'both'] as const, 'one'),
    count: Math.round(number(one(q, 'n'), 1, 1, 1000)),
    preset: oneOf(one(q, 'preset'), DECOR_PRESETS.map((p) => p.key), 'diy-pce-30l-batch'),
    holdsWater: flag(one(q, 'hw')),
    assumed: (one(q, 'as') ?? '').split(',').filter((f): f is FineConcreteField => (FIELDS as readonly string[]).includes(f)),
  };
}

export function encodeFineConcrete(s: FineConcreteState): Record<string, string> {
  const cm = (v: number | null) => (v === null ? undefined : String(v));
  return compact({
    q: s.q || undefined,
    shape: unlessDefault(s.shape, 'hollow'),
    l: cm(s.length),
    b: cm(s.width),
    h: cm(s.height),
    d: cm(s.diameter),
    t: cm(s.wall),
    open: unlessDefault(s.open, 'one'),
    n: unlessDefault(s.count, 1),
    preset: unlessDefault(s.preset, 'diy-pce-30l-batch'),
    as: s.assumed.length ? s.assumed.join(',') : undefined,
    hw: s.holdsWater ? '1' : undefined,
  });
}

// ── Bag tool ────────────────────────────────────────────────────────────────────────────

export interface BagToolState {
  mix: BagMixId;
  volume: number;
  options: BagOptions;
}

const OPTION_KEYS = { extraCement: 'zc', flyAsh: 'fa', silicaFume: 'sf', air: 'lp', waterproofing: 'wu' } as const;

export function decodeBagTool(q: Query): BagToolState {
  return {
    mix: oneOf(one(q, 'mix'), BAG_MIXES.map((m) => m.id), 'c25'),
    volume: number(one(q, 'v'), 0.1, 0.001, 100),
    options: {
      extraCement: flag(one(q, OPTION_KEYS.extraCement)),
      flyAsh: flag(one(q, OPTION_KEYS.flyAsh)),
      silicaFume: flag(one(q, OPTION_KEYS.silicaFume)),
      air: flag(one(q, OPTION_KEYS.air)),
      waterproofing: flag(one(q, OPTION_KEYS.waterproofing)),
      plasticizer: oneOf(one(q, 'p'), PLASTICIZERS, 'none'),
    },
  };
}

export function encodeBagTool(s: BagToolState): Record<string, string> {
  const o = s.options;
  return compact({
    mix: unlessDefault(s.mix, 'c25'),
    v: unlessDefault(s.volume, 0.1),
    ...Object.fromEntries(Object.entries(OPTION_KEYS).map(([opt, key]) => [key, o[opt as keyof typeof OPTION_KEYS] ? '1' : undefined])),
    p: unlessDefault(o.plasticizer, 'none'),
  });
}
