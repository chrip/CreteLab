// Scale a published fine-mortar recipe to a batch and check it against literature windows.
import type { DecorBatch, DecorPreset, Densities } from './presets';

// PCE superplasticisers are about 60 % water; counting it matches published w/b values
// (Kassel Heft 1, Tabelle 3.2-1, footnote 1).
const PCE_WATER_SHARE = 0.6;
// Binder credit in w/b: microsilica is reactive (k = 1,0), quartz flour inert (k = 0).
const K_MICROSILICA = 1.0;

/** Fresh volume of one batch in litres: Σ m / ρ (B 20 Tafel 9). */
export function batchVolumeL(batch: DecorBatch, rho: Densities): number {
  const pceKg = (batch.superplasticizerMl / 1000) * rho.superplasticizer;
  return (
    batch.cementKg / rho.cement +
    batch.sandKg / rho.sand +
    batch.quartzPowderKg / rho.quartzPowder +
    batch.finesKg / rho.fines +
    batch.microsilicaKg / rho.microsilica +
    batch.waterL / rho.water +
    pceKg / rho.superplasticizer +
    batch.fibresG / 1000 / rho.fibres
  );
}

export interface DecorRecipe {
  cementKg: number;
  sandKg: number;
  quartzPowderKg: number;
  finesKg: number;
  microsilicaKg: number;
  waterL: number;
  superplasticizerL: number;
  fibresG: number;
  totalKg: number;
  /** Target volume ÷ the source batch's volume. */
  scale: number;
  freshDensity: number;
  /** (water + PCE water) ÷ (cement + microsilica) */
  wb: number;
  /** PCE in % of the cement mass */
  pcePct: number;
}

/** The source recipe scaled linearly to `volumeM3` of fresh mix. */
export function scaleDecorRecipe(preset: DecorPreset, volumeM3: number): DecorRecipe {
  if (!(volumeM3 > 0)) throw new RangeError('volume must be > 0');
  const { batch, densities: rho } = preset;
  const scale = (volumeM3 * 1000) / batchVolumeL(batch, rho);
  const pceKg = (batch.superplasticizerMl / 1000) * rho.superplasticizer;
  const batchKg =
    batch.cementKg + batch.sandKg + batch.quartzPowderKg + batch.finesKg +
    batch.microsilicaKg + batch.waterL + pceKg + batch.fibresG / 1000;
  return {
    cementKg: batch.cementKg * scale,
    sandKg: batch.sandKg * scale,
    quartzPowderKg: batch.quartzPowderKg * scale,
    finesKg: batch.finesKg * scale,
    microsilicaKg: batch.microsilicaKg * scale,
    waterL: batch.waterL * scale,
    superplasticizerL: (batch.superplasticizerMl / 1000) * scale,
    fibresG: batch.fibresG * scale,
    totalKg: batchKg * scale,
    scale,
    freshDensity: (batchKg / batchVolumeL(batch, rho)) * 1000,
    wb: (batch.waterL + PCE_WATER_SHARE * pceKg) / (batch.cementKg + K_MICROSILICA * batch.microsilicaKg),
    pcePct: (pceKg / batch.cementKg) * 100,
  };
}

export type Level = 'ok' | 'warn' | 'error';
export interface PlausibilityCheck {
  id: 'wb' | 'pce' | 'density';
  value: number;
  level: Level;
}

/**
 * Windows from the literature: w/b 0,20–0,32 typical for UHPC (DAfStb Heft 561, fib MC 2010);
 * the white DIY mixes of Grey Element sit at 0,42, so the tolerant band reaches 0,45.
 * PCE 0,8–3,0 % of cement (Sika/BASF datasheets, absolute 0,3–4,0 %), fresh density
 * 2300–2500 kg/m³ (fib MC 2010 §5.1). Outside the outer band is an error.
 */
const WINDOWS = {
  wb: { ok: [0.2, 0.32], warn: [0.18, 0.45], digits: 2 },
  pce: { ok: [0.8, 3.0], warn: [0.3, 4.0], digits: 1 },
  density: { ok: [2300, 2500], warn: [2200, 2600], digits: 0 },
} as const;

// Classify the value as shown (rounded), so "4,0 %" is never an error because of 4,01 %.
function classify(id: PlausibilityCheck['id'], value: number): PlausibilityCheck {
  const w = WINDOWS[id];
  const shown = Math.round(value * 10 ** w.digits) / 10 ** w.digits;
  const inside = ([lo, hi]: readonly [number, number]) => shown >= lo && shown <= hi;
  return { id, value, level: inside(w.ok) ? 'ok' : inside(w.warn) ? 'warn' : 'error' };
}

export function checkDecorRecipe(r: DecorRecipe): PlausibilityCheck[] {
  return [classify('wb', r.wb), classify('pce', r.pcePct), classify('density', r.freshDensity)];
}
