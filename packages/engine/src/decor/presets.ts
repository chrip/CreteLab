// Published fine-mortar and UHPC recipes for thin decorative pieces and furniture.
//
// These mixes (binder 700–900 kg/m³, w/b 0,18–0,42, grain ≤ 2 mm) are outside Zement-
// Merkblatt B 20, so strength is not predicted: a published recipe is scaled to the batch
// and checked against literature windows (plausibility.ts). Every preset cites a source
// that can be checked; the quoted amounts are in the comments. Mixing steps are part of the
// UI texts (decor.presets.<key>.steps), in the author's order.

export interface DecorSource {
  type: 'article' | 'paper';
  title: string;
  url: string;
  author: string;
  /** ISO date the amounts were checked against the source. */
  retrieved: string;
}

/** Amounts of one batch exactly as the source gives them. */
export interface DecorBatch {
  cementKg: number;
  sandKg: number;
  /** Inert quartz flour (k = 0). */
  quartzPowderKg: number;
  /** Other inert fillers such as limestone flour. */
  finesKg: number;
  /** Reactive pozzolan, counts as binder with k = 1,0. */
  microsilicaKg: number;
  waterL: number;
  superplasticizerMl: number;
  /** Alkali-resistant glass fibres. */
  fibresG: number;
}

/** kg/dm³ */
export interface Densities {
  cement: number;
  sand: number;
  quartzPowder: number;
  fines: number;
  microsilica: number;
  water: number;
  superplasticizer: number;
  fibres: number;
}

export interface DecorPreset {
  key: string;
  source: DecorSource;
  batch: DecorBatch;
  densities: Densities;
  /** Number of mixing steps in the UI texts. */
  steps: number;
  /** The source states the piece can stay outdoors all year. */
  outdoor: boolean;
  /** Mixed by hand in a bucket (small batches). */
  handMixed: boolean;
  /** Wall thickness the source uses the mix for, mm. */
  wallMm: [number, number] | null;
  /** 28-day strength as measured by the source (water-cured), N/mm². */
  measuredFck: number | null;
  /** Estimate for air curing at home, when the source cured under water. */
  airCuredFck: number | null;
  /** Estimate when the source gives no measurement (from its w/b). */
  estimatedFck: number | null;
}

export const DEFAULT_DENSITIES: Densities = {
  cement: 3.1, // B 20 Tafel 4
  sand: 2.65, // B 20 Tafel 5
  quartzPowder: 2.65, // B 20 Tafel 6
  fines: 2.65,
  microsilica: 2.2, // B 20 Tafel 6
  water: 1.0,
  superplasticizer: 1.1, // PCE 1,05–1,15 (Sika, BASF datasheets)
  fibres: 2.68, // AR glass, Owens Corning Cem-FIL datasheets
};

const NONE = { quartzPowderKg: 0, finesKg: 0, microsilicaKg: 0, fibresG: 0 };
const GREY_ELEMENT = 'Grey Element';

export const DECOR_PRESETS: readonly DecorPreset[] = [
  {
    // "30 kg Sand (bis 2 mm), 25 kg Zement, 9 kg Quarzsand (0,063–0,3 mm), 2,5 kg Quarzmehl,
    //  8,5 Liter Wasser, 350–400 ml Hochleistungs-Fließmittel"
    key: 'diy-pce-30l-batch',
    source: {
      type: 'article',
      title: 'Welchen Beton kann ich zur Herstellung von Betonmöbeln verwenden? — Beton-Basics',
      url: 'https://www.grey-element.de/beton-basics/beton-zur-herstellung-von-betonm%C3%B6beln/',
      author: GREY_ELEMENT,
      retrieved: '2026-09-28',
    },
    batch: { ...NONE, cementKg: 25, sandKg: 39, quartzPowderKg: 2.5, waterL: 8.5, superplasticizerMl: 375 },
    densities: DEFAULT_DENSITIES,
    steps: 5,
    outdoor: false,
    handMixed: false,
    wallMm: [10, 25],
    measuredFck: null,
    airCuredFck: null,
    estimatedFck: 55, // w/b ≈ 0,35
  },
  {
    // "8 kg Zement (CEM I), 10 kg Sandkörnung 0–2 mm, 1600 g Kalksteinmehl, 400 g Microsilica,
    //  2,4 Liter Wasser, 150 ml Hochleistungsfließmittel"
    key: 'diy-mortar-20kg-batch',
    source: {
      type: 'article',
      title: 'Hochfesten Beton (UHPC) selber herstellen — Beton-Basics',
      url: 'https://www.grey-element.de/beton-basics/hochfesten-beton-uhpc-selber-herstellen/',
      author: GREY_ELEMENT,
      retrieved: '2026-09-28',
    },
    batch: { ...NONE, cementKg: 8, sandKg: 10, finesKg: 1.6, microsilicaKg: 0.4, waterL: 2.4, superplasticizerMl: 150 },
    densities: DEFAULT_DENSITIES,
    steps: 5,
    outdoor: false,
    handMixed: false,
    wallMm: null,
    measuredFck: null,
    airCuredFck: null,
    estimatedFck: 60, // w/b ≈ 0,30
  },
  {
    // Tabelle 3.7-2, M1Q, w/z 0,24, CEM I 42,5 R, no steel fibres: 733 kg cement, 1008 kg sand
    // 0,125/0,5, 230 kg microsilica, 183 kg Feinquarz, 29,4 kg FM (÷ 1,10 = 26,7 l), 161 kg water;
    // 123 N/mm² after 28 d under water at 20 °C.
    key: 'kassel-m1q-cem42-5r',
    source: {
      type: 'paper',
      title: 'Entwicklung, Dauerhaftigkeit und Berechnung Ultrahochfester Betone (UHPC), Heft 1, Tabelle 3.7-2',
      url: 'https://www.uni-kassel.de/upress/online/frei/978-3-89958-108-9.volltext.frei.pdf',
      author: 'Fehling, Schmidt, Teichmann, Bunje, Bornemann, Middendorf — Universität Kassel',
      retrieved: '2026-04-29',
    },
    batch: { ...NONE, cementKg: 733, sandKg: 1008, quartzPowderKg: 183, microsilicaKg: 230, waterL: 161, superplasticizerMl: 26727 },
    densities: DEFAULT_DENSITIES,
    steps: 6,
    outdoor: false,
    handMixed: false,
    wallMm: null,
    measuredFck: 123,
    // Very low w/c dries itself out without a water bath: 80–85 % of the water-cured value.
    airCuredFck: 100,
    estimatedFck: null,
  },
  {
    // Tabelle 3.7-2, w/z 0,40 variant: 664 kg cement, 913 kg sand, 208 kg microsilica,
    // 165,8 kg Feinquarz, 7,3 kg FM (÷ 1,10 = 6,6 l), 262 kg water; 103 N/mm² water-cured.
    key: 'kassel-m1q-cem42-5r-soft',
    source: {
      type: 'paper',
      title: 'Entwicklung, Dauerhaftigkeit und Berechnung Ultrahochfester Betone (UHPC), Heft 1, Tabelle 3.7-2',
      url: 'https://www.uni-kassel.de/upress/online/frei/978-3-89958-108-9.volltext.frei.pdf',
      author: 'Fehling, Schmidt, Teichmann, Bunje, Bornemann, Middendorf — Universität Kassel',
      retrieved: '2026-04-29',
    },
    batch: { ...NONE, cementKg: 664, sandKg: 913, quartzPowderKg: 165.8, microsilicaKg: 208, waterL: 262, superplasticizerMl: 6636 },
    densities: DEFAULT_DENSITIES,
    steps: 6,
    outdoor: false,
    handMixed: false,
    wallMm: null,
    measuredFck: 103,
    airCuredFck: 95, // 90–95 % of the water-cured value at w/c 0,40
    estimatedFck: null,
  },
  {
    // "3 kg Sand (max. 2 mm), 5 kg Quarzsand (0,063–0,3 mm), 1,5 kg Quarzmehl, 5,5 kg Weißzement,
    //  2,2 l Wasser, ca. 200 ml Fließmittel" – "Aufgrund seiner Witterungsbeständigkeit kann er
    //  ganzjährig im Freien stehen." Sprayed first coat, then laminated with glass-fibre mesh.
    key: 'diy-white-15kg-laminate',
    source: {
      type: 'article',
      title: 'DIY Firetable aus Beton',
      url: 'https://www.grey-element.de/diy-betonm%C3%B6bel/diy-firetable-aus-beton/',
      author: GREY_ELEMENT,
      retrieved: '2026-09-28',
    },
    batch: { ...NONE, cementKg: 5.5, sandKg: 8, quartzPowderKg: 1.5, waterL: 2.2, superplasticizerMl: 200 },
    densities: DEFAULT_DENSITIES,
    steps: 5,
    outdoor: true,
    handMixed: false,
    wallMm: [10, 15],
    measuredFck: null,
    airCuredFck: null,
    estimatedFck: 45, // w/b ≈ 0,42
  },
  {
    // "1,25 kg Weißzement, 0,75 kg Sand (max. 2 mm), 1,5 kg Quarzsand (0,063–0,3 mm),
    //  5 g Armierungsfasern, 500 ml Wasser, 30 ml Hochleistungsfließmittel" – fruit bowl, Ø 33 cm.
    key: 'diy-white-bowl-4kg',
    source: {
      type: 'article',
      title: 'DIY Obstschale aus Beton',
      url: 'https://www.grey-element.de/diy-betonm%C3%B6bel/diy-obstschale-aus-beton/',
      author: GREY_ELEMENT,
      retrieved: '2026-09-28',
    },
    batch: { ...NONE, cementKg: 1.25, sandKg: 2.25, waterL: 0.5, superplasticizerMl: 30, fibresG: 5 },
    densities: DEFAULT_DENSITIES,
    steps: 4,
    outdoor: false,
    handMixed: true,
    wallMm: null,
    measuredFck: null,
    airCuredFck: null,
    estimatedFck: 45, // w/b ≈ 0,42
  },
];

export type DecorPresetKey = (typeof DECOR_PRESETS)[number]['key'];

export function decorPreset(key: string | undefined): DecorPreset | undefined {
  return DECOR_PRESETS.find((p) => p.key === key);
}

/** The strength a home workshop can expect: air-cured estimate, then measured, then estimated. */
export function expectedFck(p: DecorPreset): number {
  return p.airCuredFck ?? p.measuredFck ?? p.estimatedFck ?? 0;
}
