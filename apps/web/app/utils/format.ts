// Number formatting for both languages ("2,70 m³" / "2.70 m³"). Pure, so it is unit-tested.

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
