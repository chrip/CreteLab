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
 * @property {number} microsilicaKg      Highly reactive pozzolan; counts toward
 *                                       binder with k_s = 1.0 (B 20 Tafel 9).
 * @property {number} waterL
 * @property {number} superplasticizerMl PCE-based, see ref [4] for window.
 */

/**
 * @typedef {Object} UhpcDensities  ρ in kg/dm³ (= t/m³ = g/cm³).
 * @property {number} cement
 * @property {number} sand
 * @property {number} quartzPowder
 * @property {number} fines
 * @property {number} microsilica
 * @property {number} water
 * @property {number} superplasticizer
 */

/**
 * @typedef {Object} UhpcPreset
 * @property {string}       key            Stable identifier (used in URLs / storage).
 * @property {string}       label          Generic, copyright-safe UI label.
 * @property {UhpcSource}   source
 * @property {UhpcBatch}    batch          Source-verbatim masses for one batch.
 * @property {UhpcDensities} densities
 * @property {string[]}     mixingSteps      Step-by-step instructions; may contain
 *                                           placeholders {cementKg}, {sandKg},
 *                                           {quartzPowderKg}, {finesKg},
 *                                           {microsilicaKg}, {waterL},
 *                                           {superplasticizerL} — substituted at
 *                                           render time with the user's scaled
 *                                           quantities.
 * @property {?number}      claimedFckMpa    Measured 28-d strength stated by the
 *                                           source (null if the source does not
 *                                           give a number).
 * @property {?number}      estimatedFckMpa  Walzkurven-based 28-d estimate when
 *                                           the source provides no measurement.
 *                                           Calibrated as documented in each
 *                                           preset's per-line comment so a
 *                                           reviewer can audit the derivation.
 */

// Densities pulled from the existing densities lib where applicable; the
// PCE figure is a typical mid-range from the Sika/BASF datasheets [4].
const DENSITIES_DEFAULT = Object.freeze({
    cement:           3.10, // Portlandzement, B20 Tafel 4 (densities.js)
    sand:             2.65, // Quarzkiessand mid-range, B20 Tafel 5 (densities.js)
    quartzPowder:     2.65, // Quarzmehl, B20 Tafel 6 (densities.js)
    fines:            2.65, // assumed quarz-based fines
    microsilica:      2.20, // Silikastaub, B20 Tafel 6 (densities.js
                            //   ADDITIVE_DENSITIES.Silikastaub.density)
    water:            1.00, // densities.js WATER_DENSITY
    superplasticizer: 1.10, // PCE typical 1.05–1.15, datasheet midpoint [4]
});

/** @type {UhpcPreset[]} */
export const UHPC_PRESETS = [
    {
        key: 'diy-pce-30l-batch',
        label: 'DIY-Hochleistungsbeton (mit Quarzmehl & Feinzuschlägen)',
        source: {
            type: 'youtube',
            title: 'Ultra-Hochleistungsbeton (UHPC) selber mischen — DIY-Tutorial',
            url:   'https://www.youtube.com/watch?v=DHYNh2xqijs',
            author: 'Grey Element',
            retrieved: '2026-04-28',
        },
        batch: {
            cementKg:           25,    // Portlandzement CEM I
            sandKg:             30,    // 0/2 mm
            quartzPowderKg:     9,     // 0,063–0,25 mm
            finesKg:            2.5,   // Feinzuschläge < 63 µm
            microsilicaKg:      0,     // not used in this DIY recipe
            waterL:             8.5,
            superplasticizerMl: 375,   // midpoint of stated range 350–400 ml
        },
        densities: { ...DENSITIES_DEFAULT },
        mixingSteps: [
            '<strong>Trockenmischung vormischen</strong> ({cementKg} Zement + {sandKg} Sand + {quartzPowderKg} Quarzmehl + {finesKg} Feinzuschläge) — gut homogenisieren.',
            '<strong>PCE-Fließmittel im Anmachwasser auflösen</strong> ({superplasticizerL} PCE in {waterL} Wasser einrühren).',
            '<strong>Wasser-PCE-Mischung langsam zur Trockenmischung geben</strong> und mindestens 5 Minuten kräftig mischen — Fließverhalten entwickelt sich verzögert.',
            '<strong>In geölte Form gießen und vibrieren</strong> oder leicht klopfen, bis keine Luftblasen mehr aufsteigen.',
            '<strong>Mindestens 24 h abdecken / feucht halten</strong>, vorsichtig ausschalen, mehrere Tage nachhärten lassen.',
        ],
        claimedFckMpa: null,
        // Walzkurven-Schätzung (CEM I 42,5R, A=31, n=0,67) bei w/z ≈ 0,34:
        //   fcm = 31 × (1/0,34)^0,67 ≈ 64 → fck ≈ 56 N/mm². Der inerte Quarzmehl-
        //   und Feinzuschlag-Microfiller bringt typisch 10–15 % Packungs-
        //   dichte-Bonus; konservativer Mittelwert 65 N/mm².
        estimatedFckMpa: 65,
    },
    {
        key: 'diy-mortar-20kg-batch',
        label: 'DIY-Hochfester Mörtel (ohne Quarzmehl)',
        source: {
            // Quoted recipe (verbatim) from the article body:
            //   "Meine Mischung für ca. 20 kg hochfesten Mörtel setzt sich
            //    wie folgt zusammen:
            //      - 8 kg Zement (CEM I)
            //      - 10 kg Sandkörnung 0 - 2 mm
            //      - 2,4 Liter Wasser
            //      - 150 ml Hochleistungsfließmittel EasyFlow Pro"
            type: 'datasheet',
            title: 'Hochfesten Beton (UHPC) selber herstellen — Beton-Basics',
            url:   'https://www.grey-element.de/beton-basics/hochfesten-beton-uhpc-selber-herstellen/',
            author: 'Grey Element',
            retrieved: '2026-04-28',
        },
        batch: {
            cementKg:           8,    // CEM I
            sandKg:             10,   // 0/2 mm — Quarz- oder Basaltsand
            quartzPowderKg:     0,    // not used in this simpler recipe
            finesKg:            0,
            microsilicaKg:      0,
            waterL:             2.4,  // → w/z = 0.30 (within UHPC literature range)
            superplasticizerMl: 150,  // EasyFlow Pro PCE — ~2 % of cement mass
        },
        densities: { ...DENSITIES_DEFAULT },
        // Author's mixing order (paraphrased from the article):
        //   "Zement und Zuschläge mit einem Teil des Anmischwassers anmischen,
        //    dann das Fließmittel mit dem Rest des Anmischwassers zugeben."
        mixingSteps: [
            '<strong>Zement und trockenen Sand mit ca. einem Drittel des Anmachwassers anmischen</strong> ({cementKg} Zement + {sandKg} Sand + ca. 0,8 l Wasser). Sand muss <em>trocken</em> sein — feuchter Sand verschiebt den w/z-Wert.',
            '<strong>PCE-Fließmittel im restlichen Wasser auflösen</strong> ({superplasticizerL} PCE in den restlichen ca. 1,6 l Wasser einrühren).',
            '<strong>Wasser-PCE-Mischung schrittweise zugeben und mindestens 5 Minuten kräftig mischen</strong> — idealerweise im Zwangsmischer. Das Fließmittel entwickelt seine volle Wirkung erst nach gleichmäßiger Verteilung.',
            '<strong>In geölte Form gießen und vibrieren</strong> oder leicht klopfen, bis keine Luftblasen mehr aufsteigen.',
            '<strong>Mindestens 24 h abdecken / feucht halten</strong>, vorsichtig ausschalen, mehrere Tage nachhärten lassen.',
        ],
        claimedFckMpa: null,
        // Walzkurven-Schätzung (CEM I 42,5R, A=31, n=0,67) bei w/z = 0,30:
        //   fcm = 31 × (1/0,30)^0,67 ≈ 69 → fck ≈ 61 N/mm². Ohne Microfiller,
        //   leichter PCE-Bonus durch bessere Zementdispergierung. Konservative
        //   Schätzung 60 N/mm².
        estimatedFckMpa: 60,
    },
    {
        // Per-m³ research recipe.  At a fresh-batch volume of ~1 m³ this is
        // a much larger mix than the two DIY presets above; users typically
        // scale it down to 5–30 l for hobby-sized projects.
        key: 'kassel-m1q-cem42-5r',
        label: 'Forschungs-Feinkornbeton (volle PCE-Dosierung)',
        source: {
            // Verbatim from Tabelle 3.7-2 (M1Q, w/z=0,24, CEM I 42,5 R variant):
            //   CEM I 42,5R           733 kg/m³
            //   Sand 0,125/0,5       1008 kg/m³
            //   Microsilica           230 kg/m³
            //   Drahtfasern 9/0,15      0 kg/m³  (variant without steel fibres)
            //   Feinquarz Q I         183 kg/m³
            //   FM 1                 29,4 kg/m³
            //   Wasser                161 kg/m³
            //   w/z (w/b)        0,24 (0,19)
            //   Druckfestigkeit 28 d, Wasserlagerung 20 °C: 123 N/mm²
            type: 'paper',
            title: 'Entwicklung, Dauerhaftigkeit und Berechnung Ultrahochfester Betone (UHPC), Heft 1, Tabelle 3.7-2',
            url:   'https://www.uni-kassel.de/upress/online/frei/978-3-89958-108-9.volltext.frei.pdf',
            author: 'Fehling, Schmidt, Teichmann, Bunje, Bornemann, Middendorf — Universität Kassel',
            retrieved: '2026-04-29',
        },
        batch: {
            cementKg:           733,    // CEM I 42,5 R — Baumarkt-tauglich
            sandKg:            1008,    // Quarzsand 0,125/0,5 mm
            quartzPowderKg:     183,    // Feinquarz Q I (inert filler)
            finesKg:              0,    // not split out separately in this recipe
            microsilicaKg:      230,    // hochreiner Silicastaub, k_s = 1,0
            waterL:             161,
            superplasticizerMl: 26727,  // 29,4 kg/m³ ÷ 1,10 kg/dm³ = 26,727 l/m³
                                        //   = 26 727 ml/m³
        },
        densities: { ...DENSITIES_DEFAULT },
        // Mixing procedure paraphrased from sections 5.3 (Mischen) and 5.5
        // (Lagerung) of the Kassel research report. Quote: "längere Mischzeiten
        // ... zwischen 5 und 10 Minuten" und "verdichtet ... mit handelsüblichen
        // Rüttelflaschen" und "nach 24 oder 48 Stunden ausgeschalt".
        mixingSteps: [
            '<strong>Trockenmischung gut homogenisieren</strong>: {cementKg} Zement + {sandKg} Sand (0,125–0,5 mm) + {microsilicaKg} Mikrosilica + {quartzPowderKg} Quarzmehl. Bei UHPC ist die Vermischung der Feinststoffe entscheidend — mind. 2 Minuten trocken mischen.',
            '<strong>PCE-Fließmittel im Anmachwasser auflösen</strong> ({superplasticizerL} PCE in {waterL} Wasser einrühren).',
            '<strong>Wasser-PCE-Mischung schrittweise zur Trockenmischung geben</strong> und insgesamt 5–10 Minuten kräftig mischen — idealerweise im Zwangsmischer. Achtung: Die Frischbetontemperatur kann bei größeren Mengen auf bis zu 40 °C steigen — der Beton steift dann schneller an.',
            '<strong>In geölte Form gießen und mit handelsüblicher Rüttelflasche verdichten</strong>, bis der Beton selbstnivellierend wirkt.',
            '<strong>Nach 24–48 Stunden ausschalen</strong> (je nach Verzögererwirkung des Fließmittels), dann 28 Tage unter Wasser bei 20 °C lagern. Druckfestigkeit ohne Wärmebehandlung lt. Quelle: ~123 N/mm² nach 28 d. Mit 48 h Wärmebehandlung bei 90 °C deutlich höher.',
        ],
        // Tabelle 3.7-2: 28-Tage-Druckfestigkeit (Wasserlagerung 20 °C, ohne
        // Wärmebehandlung, ohne Fasern, mit CEM I 42,5 R).
        claimedFckMpa:   123,
        estimatedFckMpa: null,
    },
    {
        // Variante derselben Tabelle 3.7-2 mit moderater PCE-Dosierung
        // (~1 % vom Zement statt ~4 %). Damit liegt die Fließmittel-Menge
        // im Datenblatt-Mittelfeld der meisten Hersteller — für Heim-Mischer
        // ohne Industrie-PCE deutlich praktischer. Strength tradeoff: 103
        // statt 123 N/mm² nach 28 d (immer noch deutlich über Normalbeton).
        key: 'kassel-m1q-cem42-5r-soft',
        label: 'Forschungs-Feinkornbeton (moderate PCE-Dosierung, für Innenbereich)',
        source: {
            // Tabelle 3.7-2, Spalte w/z = 0,40, CEM I 42,5 R, ohne Fasern:
            //   CEM I 42,5R           664 kg/m³
            //   Sand 0,125/0,5        913 kg/m³
            //   Microsilica           208 kg/m³
            //   Drahtfasern             0 kg/m³
            //   Feinquarz Q I       165,8 kg/m³
            //   FM 1                  7,3 kg/m³
            //   Wasser                262 kg/m³
            //   w/z (w/b)        0,40 (0,26)
            //   Druckfestigkeit 28 d, Wasserlagerung 20 °C: 103 N/mm²
            type: 'paper',
            title: 'Entwicklung, Dauerhaftigkeit und Berechnung Ultrahochfester Betone (UHPC), Heft 1, Tabelle 3.7-2',
            url:   'https://www.uni-kassel.de/upress/online/frei/978-3-89958-108-9.volltext.frei.pdf',
            author: 'Fehling, Schmidt, Teichmann, Bunje, Bornemann, Middendorf — Universität Kassel',
            retrieved: '2026-04-29',
        },
        batch: {
            cementKg:           664,
            sandKg:             913,
            quartzPowderKg:     165.8,
            finesKg:              0,
            microsilicaKg:      208,
            waterL:             262,
            superplasticizerMl: 6636,  // 7,3 kg/m³ ÷ 1,10 kg/dm³ = 6,636 l/m³
        },
        densities: { ...DENSITIES_DEFAULT },
        mixingSteps: [
            '<strong>Trockenmischung gut homogenisieren</strong>: {cementKg} Zement + {sandKg} Sand (0,125–0,5 mm) + {microsilicaKg} Mikrosilica + {quartzPowderKg} Quarzmehl. Mind. 2 Minuten trocken vormischen — die Feinststoff-Verteilung bestimmt die spätere Festigkeit.',
            '<strong>PCE-Fließmittel im Anmachwasser auflösen</strong> ({superplasticizerL} PCE in {waterL} Wasser einrühren). Diese Variante kommt mit einer DIY-typischen PCE-Dosierung aus.',
            '<strong>Wasser-PCE-Mischung schrittweise zur Trockenmischung geben</strong> und 5–10 Minuten kräftig mischen. Das Fließverhalten entwickelt sich verzögert — anfangs „grießig", nach einigen Minuten geschmeidig.',
            '<strong>In geölte Form gießen und mit handelsüblicher Rüttelflasche verdichten</strong>, bis Oberfläche glänzt.',
            '<strong>Nach 24–48 h ausschalen</strong>, dann 28 Tage feucht/im Wasser bei 20 °C nachhärten. Quelle: ~103 N/mm² nach 28 d (Wasserlagerung, ohne Wärmebehandlung, ohne Fasern).',
        ],
        // Tabelle 3.7-2, w/z=0,40 Variante: 28-Tage-Druckfestigkeit
        // (Wasserlagerung 20 °C, ohne Wärmebehandlung, ohne Fasern).
        claimedFckMpa:   103,
        estimatedFckMpa: null,
    },
];

/**
 * @param {string} key
 * @returns {UhpcPreset | null}
 */
export function getUhpcPreset(key) {
    return UHPC_PRESETS.find(p => p.key === key) || null;
}
