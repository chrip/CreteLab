// What the exposure classes say about the component itself.
import type { ExposureClass } from '@cretelab/engine';

/** Carbonation and chloride classes only exist for reinforced concrete (DIN 1045-2, Tab. 1). */
export function isReinforced(classes: readonly ExposureClass[]): boolean {
  return classes.some((c) => c.startsWith('XC') || c.startsWith('XD') || c.startsWith('XS'));
}

export function heavyTraffic(classes: readonly ExposureClass[]): boolean {
  return classes.includes('XM2') || classes.includes('XM3');
}
