// uhpc-presets.js — verifiable UHPC mix-design presets.
//
// SCOPE
// -----
// Ultra-High Performance Concrete (UHPC) is *outside* the envelope of
// Zement-Merkblatt B 20 / DIN EN 206 (which CreteLab's main calculator
// implements):
//
//   • binder content typically 700–900 kg/m³  (vs ≤ 400 in normal-strength)
//   • w/b ratio 0.18–0.30                     (vs 0.35–0.85)
//   • max grain ≤ 2 mm and packing-optimised  (vs B/A 16 / 32 sieve lines)
//   • compressive strength 130–200 N/mm²      (vs ≤ 115 N/mm² for C100/115)
//
// Predicting UHPC strength from first principles requires modelling
// pozzolanic activity of the silica/quartz microfiller and the particle-
// packing density — both unsolved by simple Walzkurven. To stay honest,
// CreteLab does NOT predict UHPC strength. It scales a published recipe
// linearly to the user's batch volume and surfaces plausibility chips
// (w/b, PCE dosage, density) computed from well-established formulas.
//
// SOURCING POLICY
// ---------------
// Every preset must cite a verifiable source (URL, paper, datasheet).
// No "averaged from the web" mixes. The label shown in the UI is
// generic — the source citation lives in the code so reviewers and
// future maintainers can verify masses against the original.
//
// REFERENCES (general UHPC background; cited in plausibility checks)
//   [1] DAfStb-Heft 561, "Sachstandbericht Ultrahochfester Beton" (2008).
//   [2] fib Model Code 2010, §5.1 (UHPC density 2300–2500 kg/m³,
//       fck ≥ 130 N/mm² typical).
//   [3] Schmidt, Fehling et al., "Ultra-High Performance Concrete:
//       research, development and application in Europe", RILEM
//       Symposium proceedings, 2004.
//   [4] Sika ViscoCrete / BASF MasterGlenium product datasheets:
//       PCE superplasticiser dosage 0.3–4 % of cement mass.

/**
 * @typedef {Object} UhpcSource
 * @property {('youtube'|'paper'|'datasheet')} type
 * @property {string} title           Human-readable source title.
 * @property {string} url             Verifiable URL (or DOI).
 * @property {string} [author]
 * @property {string} [retrieved]     ISO date when the recipe was last verified.
 */

/**
 * @typedef {Object} UhpcBatch     Verbatim component masses from the source.
 * @property {number} cementKg
 * @property {number} sandKg
 * @property {number} quartzPowderKg
 * @property {number} finesKg            Fine fillers (e.g. quartz flour < 63 µm).
 * @property {number} waterL
 * @property {number} superplasticizerMl PCE-based, see ref [4] for window.
 */

/**
 * @typedef {Object} UhpcDensities  ρ in kg/dm³ (= t/m³ = g/cm³).
 * @property {number} cement
 * @property {number} sand
 * @property {number} quartzPowder
 * @property {number} fines
 * @property {number} water
 * @property {number} superplasticizer
 */

/**
 * @typedef {Object} UhpcPreset
 * @property {string}       key       Stable identifier (used in URLs / storage).
 * @property {string}       label     Generic, copyright-safe UI label.
 * @property {UhpcSource}   source
 * @property {UhpcBatch}    batch     Source-verbatim masses for one batch.
 * @property {UhpcDensities} densities
 * @property {string[]}     notes     Author's mixing notes (verbatim or paraphrased).
 * @property {?number}      claimedFckMpa  If the source states a strength.
 */

// Densities pulled from the existing densities lib where applicable; the
// PCE figure is a typical mid-range from the Sika/BASF datasheets [4].
const DENSITIES_DEFAULT = Object.freeze({
    cement:           3.10, // Portlandzement, B20 Tafel 4 (densities.js)
    sand:             2.65, // Quarzkiessand mid-range, B20 Tafel 5 (densities.js)
    quartzPowder:     2.65, // Quarzmehl, B20 Tafel 6 (densities.js)
    fines:            2.65, // assumed quarz-based fines
    water:            1.00, // densities.js WATER_DENSITY
    superplasticizer: 1.10, // PCE typical 1.05–1.15, datasheet midpoint [4]
});

/** @type {UhpcPreset[]} */
export const UHPC_PRESETS = [
    {
        key: 'diy-pce-30l-batch',
        label: 'DIY-Hochleistungsbeton (~30 l Charge, PCE-Fließmittel)',
        source: {
            type: 'youtube',
            title: 'Ultra-Hochleistungsbeton (UHPC) selber mischen — DIY-Tutorial',
            url:   'https://www.youtube.com/@GreyElement', // channel; recipe is in the video description
            author: 'Grey Element',
            retrieved: '2026-04-28',
        },
        batch: {
            cementKg:           25,    // Portlandzement CEM I
            sandKg:             30,    // 0/2 mm
            quartzPowderKg:     9,     // 0,063–0,25 mm
            finesKg:            2.5,   // Feinzuschläge < 63 µm
            waterL:             8.5,
            superplasticizerMl: 375,   // midpoint of stated range 350–400 ml
        },
        densities: { ...DENSITIES_DEFAULT },
        notes: [
            'Trockenmischung erst gut vormischen (Zement + Sand + Quarzmehl + Feinzuschläge).',
            'PCE-Fließmittel im Anmachwasser auflösen, dann langsam zugeben.',
            'Mindestens 5 Minuten kräftig mischen — Fließverhalten entwickelt sich verzögert.',
            'In geölte Form gießen und vibrieren / leicht klopfen für blasenfreies Ergebnis.',
        ],
        claimedFckMpa: null, // source does not state a measured strength
    },
];

/**
 * @param {string} key
 * @returns {UhpcPreset | null}
 */
export function getUhpcPreset(key) {
    return UHPC_PRESETS.find(p => p.key === key) || null;
}
