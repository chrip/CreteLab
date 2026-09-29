// Bagged dry concrete as declared on German manufacturer datasheets, accessed 2026-09-29.
// Research, quotes and the rules built on it: docs/research/bagged-concrete.md.
import type { ExposureClass } from '../b20/exposure';
import type { StrengthClass } from '../b20/strength';

export interface BagProduct {
  id: string;
  manufacturer: string;
  product: string;
  /** Declared class after DIN 1045-2; null for post mixes that declare none. */
  strengthClass: StrengthClass | null;
  maxGrain: number;
  /**
   * Exposure classes the product meets: the declared ones plus the milder classes of the
   * same attack they include (a declared XC4 meets XC1–XC3, XC2 meets XC1 with the same
   * limits). X0 is met by every declared concrete.
   */
  exposureClasses: ExposureClass[];
  bagKg: number;
  /** Litres of fresh concrete per bag (datasheet, or derived from its kg/m²/mm figure). */
  yieldL: number;
  /** Mixing water per bag, litres. */
  waterL: number;
  /** The datasheet allows reinforced or load-bearing concrete. */
  structural: boolean;
  /** Sold at DIY stores ('diy') or through builders' merchants ('trade'). */
  channel: 'diy' | 'trade';
  datasheet: string;
}

export const BAG_PRODUCTS: readonly BagProduct[] = [
  {
    id: 'weber-mix-692',
    manufacturer: 'Saint-Gobain Weber',
    product: 'weber.mix 692 Beton/Estrich C25/30',
    strengthClass: 'C25/30',
    maxGrain: 8,
    exposureClasses: ['XC1', 'XC2', 'XC3', 'XC4', 'XF1', 'XA1'],
    bagKg: 40,
    yieldL: 22,
    waterL: 4,
    structural: true, // "für statisch relevante Bauteile"
    channel: 'diy',
    datasheet: 'https://bilder.obi.de/80f0c686-e4e2-490b-9703-8c95b47305dc/document.pdf',
  },
  {
    id: 'sakret-be',
    manufacturer: 'SAKRET',
    product: 'Beton/Estrich BE',
    strengthClass: 'C25/30',
    maxGrain: 8,
    exposureClasses: ['XC1', 'XC2', 'XC3', 'XC4', 'XF1', 'XA1'],
    bagKg: 30,
    yieldL: 13.6, // derived from 2,2 kg/m²/mm
    waterL: 2.5,
    structural: true, // "Beton und Stahlbeton"
    channel: 'diy',
    datasheet: 'https://www.rygol-sakret.de/fileadmin/user_upload/tm/tm_beton_estrich_be.pdf',
  },
  {
    id: 'quick-mix-b03',
    manufacturer: 'quick-mix',
    product: 'B 03 Estrich/Beton',
    strengthClass: 'C25/30',
    maxGrain: 8,
    exposureClasses: ['XC1', 'XC2', 'XC3', 'XC4', 'XF1', 'XA1'],
    bagKg: 40,
    yieldL: 20,
    waterL: 4,
    structural: false, // foundations, lintels, garden walls; reinforced use not stated
    channel: 'diy',
    datasheet: 'https://media.sievert.de/files/TM/TM_QUICK-MIX-B03__SDE__AIN__V6.pdf',
  },
  {
    id: 'koba-beton-estrich',
    manufacturer: 'HASIT (KOBA)',
    product: 'KOBA Beton/Estrich',
    strengthClass: 'C20/25',
    maxGrain: 6,
    exposureClasses: ['XC1', 'XC2'],
    bagKg: 30,
    yieldL: 15,
    waterL: 3.3,
    structural: false, // "für untergeordnete Betonarbeiten"
    channel: 'diy',
    datasheet: 'https://cdn.dam.fixit-holding.com/assets/api/1dea3c16-2eb4-42e5-bf73-52e5d2bc04e0/original/TM-KOBA-Beton-Estrich-Feinbeton-und-Zementestrich-de.pdf',
  },
  {
    id: 'sakret-tb-c30',
    manufacturer: 'SAKRET',
    product: 'Trockenbeton TB C30/37',
    strengthClass: 'C30/37',
    maxGrain: 8,
    exposureClasses: ['XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XS1', 'XF1', 'XA1'],
    bagKg: 30,
    yieldL: 12.9, // derived from 0,43 m³/t
    waterL: 2.75,
    structural: true,
    channel: 'trade',
    datasheet: 'https://www.rygol-sakret.de/fileadmin/user_upload/tm/tm_trockenbeton_tb.pdf',
  },
  {
    id: 'sakret-tb-c35',
    manufacturer: 'SAKRET',
    product: 'Trockenbeton TB C35/45',
    strengthClass: 'C35/45',
    maxGrain: 8,
    exposureClasses: ['XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3', 'XF1', 'XF2', 'XF3', 'XA1', 'XA2', 'XA3'],
    bagKg: 30,
    yieldL: 12.9,
    waterL: 2.75,
    structural: true,
    channel: 'trade',
    datasheet: 'https://www.rygol-sakret.de/fileadmin/user_upload/tm/tm_trockenbeton_tb.pdf',
  },
  {
    id: 'sakret-tb-c35-f6',
    manufacturer: 'SAKRET',
    product: 'Trockenbeton TB C35/45 F6',
    strengthClass: 'C35/45',
    maxGrain: 8,
    // XF4 "nachgewiesen durch CDF-Prüfung"
    exposureClasses: ['XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3', 'XF1', 'XF2', 'XF3', 'XF4', 'XA1', 'XA2', 'XA3'],
    bagKg: 30,
    yieldL: 12.9,
    waterL: 3,
    structural: true,
    channel: 'trade',
    datasheet: 'https://www.rygol-sakret.de/fileadmin/user_upload/tm/tm_trockenbeton_tb.pdf',
  },
];

/** Post mix: sets in minutes, declares no class, "nicht für statisch belastete Bauteile". */
export const POST_MIX: BagProduct = {
  id: 'sakret-setz-fix',
  manufacturer: 'SAKRET',
  product: 'Setz-Fix',
  strengthClass: null,
  maxGrain: 8,
  exposureClasses: [],
  bagKg: 25,
  yieldL: 13.2, // derived from 1,9 kg/m²/mm
  waterL: 3.5,
  structural: false,
  channel: 'diy',
  datasheet: 'https://image.hagebau.de/pdf/1000000000435529.pdf',
};

export function bagProduct(id: string | undefined): BagProduct | undefined {
  return [...BAG_PRODUCTS, POST_MIX].find((p) => p.id === id);
}
