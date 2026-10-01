// Number formatting for both languages ("2,70 m³" / "2.70 m³"). Pure, so it is unit-tested.
import type { Solid, VolumeBreakdown } from '@cretelab/engine';

export type Locale = 'de' | 'en';

const TAG: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' };

export function formatNumber(locale: Locale, value: number, digits = 0): string {
  return value.toLocaleString(TAG[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Up to `maxDigits` decimals, no trailing zeros: 2 → "2", 2,5 → "2,5". */
export function formatCompact(locale: Locale, value: number, maxDigits = 2): string {
  return value.toLocaleString(TAG[locale], { maximumFractionDigits: maxDigits });
}

/**
 * Amounts for people who weigh them: g/ml below 1 kg/l, one decimal below 10, whole
 * numbers above ("350 g", "4,5 kg", "812 kg").
 */
export function formatAmount(locale: Locale, value: number, unit: 'kg' | 'l'): string {
  if (value > 0 && value < 1) return `${formatNumber(locale, value * 1000)} ${unit === 'kg' ? 'g' : 'ml'}`;
  return `${formatNumber(locale, value, value < 10 ? 1 : 0)} ${unit}`;
}

/** Counts to the half, as on site: 8,5 → "8½", 0,5 → "½", 3 → "3". */
export function formatHalves(locale: Locale, value: number): string {
  const whole = Math.floor(value + 1e-9);
  const half = value - whole >= 0.25 ? '½' : '';
  return whole === 0 && half ? half : `${formatNumber(locale, whole)}${half}`;
}

/** A concrete volume: litres below 0,1 m³ ("12 l"), cubic metres above ("2,70 m³"). */
export function formatVolume(locale: Locale, m3: number): string {
  if (m3 < 0.1) {
    const litres = m3 * 1000;
    return `${formatNumber(locale, litres, litres < 10 ? 1 : 0)} l`;
  }
  return `${formatNumber(locale, m3, 2)} m³`;
}

/** Reads "2,5", "2.5" and " 2 " as numbers; anything else is NaN. */
export function parseDecimal(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return raw;
  if (raw === null || raw === undefined) return NaN;
  const text = raw.trim().replace(',', '.');
  return /^-?\d*\.?\d+$/.test(text) ? Number(text) : NaN;
}

/**
 * The calculation behind a volume, e.g. "6 m × 3 m × 0,15 m = 2,70 m³" or, for a planter,
 * "40 × 40 × 40 cm − 36 × 36 × 38 cm = 15 l". Small pieces are written in cm.
 */
export function formatBreakdown(locale: Locale, b: VolumeBreakdown): string {
  const lengths = [b.outer, b.inner].flatMap((s) => (s ? solidLengths(s) : []));
  const inCm = Math.max(...lengths) < 1;
  const len = (m: number) => `${formatCompact(locale, inCm ? m * 100 : m, inCm ? 1 : 3)} ${inCm ? 'cm' : 'm'}`;
  const solid = (s: Solid): string => {
    switch (s.kind) {
      case 'box':
        return `${len(s.length)} × ${len(s.width)} × ${len(s.height)}`;
      case 'area':
        return `${formatCompact(locale, s.area, 2)} m² × ${len(s.height)}`;
      case 'cylinder':
        return `π/4 × (${len(s.diameter)})² × ${len(s.height)}`;
      case 'hemisphere':
        return `π/12 × (${len(s.diameter)})³`;
    }
  };
  let text = b.inner ? `(${solid(b.outer)}) − (${solid(b.inner)})` : solid(b.outer);
  if (b.count > 1) text = `${b.inner ? `[${text}]` : text} × ${b.count}`;
  return `${text} = ${formatVolume(locale, b.volume)}`;
}

function solidLengths(s: Solid): number[] {
  switch (s.kind) {
    case 'box':
      return [s.length, s.width, s.height];
    case 'area':
      return [s.height, 1]; // an area is always a site slab: metres
    case 'cylinder':
      return [s.diameter, s.height];
    case 'hemisphere':
      return [s.diameter];
  }
}
