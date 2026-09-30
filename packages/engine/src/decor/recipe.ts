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

/** What someone mixing this recipe at home must know, from the ingredients it contains. */
export type HandlingNote = 'cement' | 'microsilica' | 'quartz' | 'fibres' | 'superplasticizer';

/**
 * Safety and handling notes for a recipe: cement is caustic when wet (GHS H315/H318 on every
 * cement safety data sheet), microsilica and quartz flour are fine, respirable dusts,
 * glass fibres irritate the skin, and superplasticiser must be measured exactly.
 */
export function handlingNotes(r: DecorRecipe): HandlingNote[] {
  const notes: HandlingNote[] = ['cement'];
  if (r.microsilicaKg > 0) notes.push('microsilica');
  if (r.quartzPowderKg > 0) notes.push('quartz');
  if (r.fibresG > 0) notes.push('fibres');
  if (r.superplasticizerL > 0) notes.push('superplasticizer');
  return notes;
}
