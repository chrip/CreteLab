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
 * @property {number} [fibresG]          Optional alkali-resistant glass fibres in g.
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
 *                                           give a number). For sources that
 *                                           measure under water curing, this is
 *                                           the verbatim water-cured value.
 * @property {?number}      airCuredFckMpa   Engineering estimate of the 28-d
 *                                           strength under typical home-shop
 *                                           air curing (no water bath). Only
 *                                           set on presets whose source uses
 *                                           water curing — for the dropdown's
 *                                           realistic-DIY display the renderer
 *                                           prefers this value.
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
        label: 'DIY-Hochleistungsbeton (mit Quarzsand & Quarzmehl)',
        source: {
            // Quoted recipe (verbatim) from the article body:
            //   "Bei meiner Mischung, bezogen auf ca. 67 kg UHPC, verwende ich
            //    folgende Komponenten:
            //      - 30 kg Sand (Korngröße bis 2 mm)
            //      - 25 kg Zement (Portlandzement)
            //      - 9 kg Quarzsand (Korngröße 0,063 - 0,3 mm)
            //      - 2,5 kg Quarzmehl
            //      - 8,5 Liter Wasser
            //      - 350 - 400 ml Hochleistungs-Fließmittel (ich verwende hier
            //        Pantarhit PC150 FM)"
            // The same amounts appear in the video DHYNh2xqijs, but its
            // description lists no amounts, so the article is the citation.
            type: 'datasheet',
            title: 'Welchen Beton kann ich zur Herstellung von Betonmöbeln verwenden? — Beton-Basics',
            url:   'https://www.grey-element.de/beton-basics/beton-zur-herstellung-von-betonm%C3%B6beln/',
            author: 'Grey Element',
            retrieved: '2026-09-28',
        },
        batch: {
            cementKg:           25,    // Portlandzement
            sandKg:             39,    // 30 kg Sand 0–2 mm + 9 kg Quarzsand 0,063–0,3 mm
            quartzPowderKg:     2.5,   // Quarzmehl (inert, k = 0)
            finesKg:            0,
            microsilicaKg:      0,     // not part of this recipe
            waterL:             8.5,
            superplasticizerMl: 375,   // midpoint of stated range 350–400 ml
        },
        densities: { ...DENSITIES_DEFAULT },
        // Author's mixing order (paraphrased from the article): dry components
        // 1–2 min, then ~80 % of the water, then the rest of the water with the
        // plasticiser; at least 20 min in a free-fall mixer. Walls of 1–2,5 cm
        // with textile reinforcement.
        mixingSteps: [
            '<strong>Trockenmischung 1–2 Minuten vormischen</strong> ({cementKg} Zement + {sandKg} Sand + {quartzPowderKg} Quarzmehl). Der Sand besteht im Verhältnis 30 : 9 aus Sand 0–2 mm und Quarzsand 0,063–0,3 mm.',
            '<strong>Ca. 80 % des Wassers zugeben</strong> und weitermischen.',
            '<strong>PCE-Fließmittel im restlichen Wasser auflösen</strong> ({superplasticizerL} PCE, gesamt {waterL} Wasser) und zugeben — insgesamt mindestens 20 Minuten mischen (Freifallmischer). Je nach Zement etwas mehr Wasser nötig.',
            '<strong>In geölte Form gießen und vibrieren</strong> oder leicht klopfen, bis keine Luftblasen mehr aufsteigen. Für Wandstärken von 1–2,5 cm mit Textilbewehrung.',
            '<strong>Mindestens 24 h abdecken / feucht halten</strong>, vorsichtig ausschalen, mehrere Tage nachhärten lassen.',
        ],
        claimedFckMpa:    null,
        airCuredFckMpa:   null,
        // Walzkurven-Schätzung (CEM I 42,5R, A=31, n=0,67) bei w/b = 0,35
        //   (8,5 l Wasser + 60 % des PCE, kein reaktiver Zusatzstoff):
        //   fcm = 31 × (1/0,35)^0,67 ≈ 63 → fck ≈ 55 N/mm². Quarzmehl ist
        //   inert und bringt keinen pozzolanischen Bonus.
        estimatedFckMpa: 55,
    },
    {
        key: 'diy-mortar-20kg-batch',
        label: 'DIY-Hochfester Mörtel (mit Kalksteinmehl & Mikrosilica)',
        source: {
            // Quoted recipe (verbatim) from the article body:
            //   "Meine Mischung für ca. 20 kg hochfesten Mörtel setzt sich
            //    wie folgt zusammen:
            //      - 8 kg Zement (CEM I)
            //      - 10 kg Sandkörnung 0 - 2 mm
            //      - 1600 g Kalksteinmehl
            //      - 400 g Microsilica Pulver
            //      - 2,4 Liter Wasser
            //      - 150 ml Hochleistungsfließmittel EasyFlow Pro"
            type: 'datasheet',
            title: 'Hochfesten Beton (UHPC) selber herstellen — Beton-Basics',
            url:   'https://www.grey-element.de/beton-basics/hochfesten-beton-uhpc-selber-herstellen/',
            author: 'Grey Element',
            retrieved: '2026-09-28',
        },
        batch: {
            cementKg:           8,    // CEM I
            sandKg:             10,   // 0/2 mm
            quartzPowderKg:     0,    // not used in this recipe
            finesKg:            1.6,  // Kalksteinmehl (< 63 µm, inert)
            microsilicaKg:      0.4,  // Microsilica Pulver, k_s = 1,0
            waterL:             2.4,
            superplasticizerMl: 150,  // EasyFlow Pro PCE
        },
        densities: { ...DENSITIES_DEFAULT },
        // Author's mixing order (paraphrased from the article):
        //   "Zement und Zuschläge mit einem Teil des Anmischwassers anmischen,
        //    dann das Fließmittel mit dem Rest des Anmischwassers zugeben."
        mixingSteps: [
            '<strong>Zement, trockenen Sand und Feinstoffe mit ca. einem Drittel des Anmachwassers anmischen</strong> ({cementKg} Zement + {sandKg} Sand + {finesKg} Kalksteinmehl + {microsilicaKg} Mikrosilica + ca. ein Drittel von {waterL} Wasser). Sand muss <em>trocken</em> sein.',
            '<strong>PCE-Fließmittel im restlichen Wasser auflösen</strong> ({superplasticizerL} PCE in den restlichen ca. zwei Dritteln des Wassers einrühren).',
            '<strong>Wasser-PCE-Mischung schrittweise zugeben und mindestens 5 Minuten kräftig mischen</strong> — idealerweise im Zwangsmischer. Das Fließmittel entwickelt seine Wirkung verzögert.',
            '<strong>In geölte Form gießen und vibrieren</strong> oder leicht klopfen, bis keine Luftblasen mehr aufsteigen.',
            '<strong>Mindestens 24 h abdecken / feucht halten</strong>, vorsichtig ausschalen, mehrere Tage nachhärten lassen.',
        ],
        claimedFckMpa:    null,
        airCuredFckMpa:   null,
        // Walzkurven-Schätzung (CEM I 42,5R, A=31, n=0,67) bei w/b = 0,30
        //   (2,4 l Wasser + 60 % des PCE auf 8 kg Zement + 0,4 kg Mikrosilica):
        //   fcm = 31 × (1/0,30)^0,67 ≈ 70 → fck ≈ 62 N/mm². Konservative
        //   Schätzung 60 N/mm² unter typischen DIY-Bedingungen.
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
            '<strong>Nach 24–48 Stunden ausschalen</strong> (je nach Verzögererwirkung des Fließmittels), dann mind. eine Woche feucht abgedeckt nachhärten lassen (z. B. unter feuchtem Tuch + Folie). Druckfestigkeit nach 28 d: ca. 100 N/mm².',
            '<strong>Optional für maximale Festigkeit:</strong> 28 Tage komplett unter Wasser bei 20 °C lagern → ~123 N/mm² (+23 %). Bei dieser sehr dichten Mischung wirkt das Wasserbad besonders stark gegen Selbst-Austrocknung der Matrix.',
        ],
        // Tabelle 3.7-2: 28-d Druckfestigkeit unter Wasserlagerung 20 °C (ohne
        // Wärmebehandlung, ohne Fasern, CEM I 42,5 R).
        claimedFckMpa:   123,
        // Engineering estimate für übliche DIY-Bedingungen ohne Wasserbad.
        // Begründung: bei sehr niedrigem w/z (0,24) hat die dichte Matrix
        // eine ausgeprägte Selbst-Austrocknungs-Tendenz, die Hydratation
        // bleibt ohne externe Wasserzufuhr unvollständig. Literatur (UHPC-
        // Reviews, RILEM TC 188-CSC) nennt 80–85 % der Wasserlagerungs-
        // festigkeit; konservativer Mittelwert: ~100 N/mm².
        airCuredFckMpa:  100,
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
            '<strong>Nach 24–48 h ausschalen</strong>, dann mind. eine Woche feucht abgedeckt nachhärten lassen. Druckfestigkeit nach 28 d: ca. 95 N/mm².',
            '<strong>Optional für maximale Festigkeit:</strong> 28 Tage komplett unter Wasser bei 20 °C lagern → ~103 N/mm² (+8 %). Bei dieser etwas weniger dichten Variante (w/z = 0,40) ist der Wasserbad-Effekt geringer, aber spürbar.',
        ],
        // Tabelle 3.7-2, w/z=0,40 Variante: 28-d Druckfestigkeit unter
        // Wasserlagerung 20 °C (ohne Wärmebehandlung, ohne Fasern).
        claimedFckMpa:   103,
        // Engineering estimate für übliche DIY-Bedingungen ohne Wasserbad.
        // Bei höherem w/z (0,40) ist die Selbst-Austrocknung deutlich
        // schwächer ausgeprägt — Literatur nennt 90–95 % der Wasser-
        // lagerungsfestigkeit; konservativer Mittelwert: ~95 N/mm².
        airCuredFckMpa:  95,
        estimatedFckMpa: null,
    },
    {
        // Sprayed and laminated white mix for thin furniture (10–15 mm walls).
        key: 'diy-white-15kg-laminate',
        label: 'DIY-Weißbeton zum Aufsprühen & Laminieren (10–15 mm, außen)',
        source: {
            // Quoted recipe (verbatim) from the article body:
            //   "Ich habe folgende Mischung bezogen auf 15 kg Beton verwendet:
            //      - 3 kg Sand (Maximalkorngröße 2 mm)
            //      - 5 kg Quarzsand (Korngröße 0,063 - 0,3 mm)
            //      - 1,5 kg Quarzmehl
            //      - 5,5 kg Weißzement
            //      - 2,2 l Wasser
            //      - ca. 200 ml Fließmittel mit einer plastifizierenden Wirkung"
            // Outdoor use: "Aufgrund seiner Witterungsbeständigkeit kann er
            // ganzjährig im Freien stehen." The same list is used for the
            // DIY-Stuhl (10 mm walls).
            type: 'datasheet',
            title: 'DIY Firetable aus Beton',
            url:   'https://www.grey-element.de/diy-betonm%C3%B6bel/diy-firetable-aus-beton/',
            author: 'Grey Element',
            retrieved: '2026-09-28',
        },
        batch: {
            cementKg:           5.5,  // Weißzement
            sandKg:             8,    // 3 kg Sand 0–2 mm + 5 kg Quarzsand 0,063–0,3 mm
            quartzPowderKg:     1.5,  // Quarzmehl (inert)
            finesKg:            0,
            microsilicaKg:      0,
            waterL:             2.2,
            superplasticizerMl: 200,  // "ca. 200 ml"
        },
        densities: { ...DENSITIES_DEFAULT },
        // Author's method (paraphrased from the article): the first coat is
        // sprayed 1,5–2 mm onto the mould; further layers are applied by hand
        // with a kneadable mix and three layers of reinforcing mesh; cure
        // 24–48 h; sealed with impregnation and wax.
        mixingSteps: [
            '<strong>Weißzement, Sand und Quarzmehl trocken vormischen</strong> ({cementKg} Weißzement + {sandKg} Sand + {quartzPowderKg} Quarzmehl). Der Sand besteht im Verhältnis 3 : 5 aus Sand 0–2 mm und Quarzsand 0,063–0,3 mm.',
            '<strong>Wasser und Fließmittel zugeben</strong> ({waterL} Wasser, {superplasticizerL} plastifizierendes Fließmittel) und gründlich mischen.',
            '<strong>Erste Schicht 1,5–2 mm auf die Schalung aufsprühen</strong>, bis die Schalung nicht mehr durchscheint.',
            '<strong>Weitere Schichten von Hand auftragen</strong> — dafür muss der Beton knetfähig sein — und dabei drei Lagen Armierungsgewebe einlegen.',
            '<strong>24–48 Stunden aushärten lassen</strong> (je nach Raumtemperatur), ausschalen und für draußen mit Imprägnierung und Wachs versiegeln.',
        ],
        claimedFckMpa:    null,
        airCuredFckMpa:   null,
        // Walzkurven-Schätzung (CEM I 42,5, A=31, n=0,67) bei w/b = 0,42
        //   (2,2 l Wasser + 60 % des Fließmittels auf 5,5 kg Zement):
        //   fcm = 31 × (1/0,42)^0,67 ≈ 55 → fck ≈ 47 N/mm². Konservativ 45.
        estimatedFckMpa: 45,
    },
    {
        // Small hand-mixed white batch for thin decorative pieces.
        key: 'diy-white-bowl-4kg',
        label: 'DIY-Weißbeton für kleine Dekostücke (von Hand gemischt)',
        source: {
            // Quoted recipe (verbatim) from the article body:
            //   "1,25 kg Weißzement
            //    0,75 kg Sand (Maximalkorngröße 2 mm)
            //    1,5 kg Quarzsand (Korngröße 0,063 - 0,3 mm)
            //    5 g Armierungsfasern
            //    500 ml Wasser
            //    30 ml Hochleistungsfließmittel"
            // Used for a fruit bowl, Ø 33 cm, with reinforcing mesh.
            type: 'datasheet',
            title: 'DIY Obstschale aus Beton',
            url:   'https://www.grey-element.de/diy-betonm%C3%B6bel/diy-obstschale-aus-beton/',
            author: 'Grey Element',
            retrieved: '2026-09-28',
        },
        batch: {
            cementKg:           1.25, // Weißzement
            sandKg:             2.25, // 0,75 kg Sand 0–2 mm + 1,5 kg Quarzsand 0,063–0,3 mm
            quartzPowderKg:     0,
            finesKg:            0,
            microsilicaKg:      0,
            waterL:             0.5,
            superplasticizerMl: 30,
            fibresG:            5,    // Armierungsfasern
        },
        densities: { ...DENSITIES_DEFAULT },
        // Author's method (paraphrased): mixed by hand, reinforcing mesh cut
        // to shape, demoulded after 48 h, sealed with impregnation and wax.
        mixingSteps: [
            '<strong>Weißzement und Sand trocken vormischen</strong> ({cementKg} Weißzement + {sandKg} Sand). Der Sand besteht im Verhältnis 1 : 2 aus Sand 0–2 mm und Quarzsand 0,063–0,3 mm.',
            '<strong>Wasser mit Fließmittel und die Fasern zugeben</strong> ({waterL} Wasser, {superplasticizerL} Hochleistungsfließmittel, {fibresG} Armierungsfasern) und von Hand gründlich mischen.',
            '<strong>In die Form einbringen und Armierungsgewebe einlegen</strong> (zugeschnitten auf die Form).',
            '<strong>Nach ca. 48 Stunden ausschalen</strong> und mit Imprägnierung und Wachs versiegeln.',
        ],
        claimedFckMpa:    null,
        airCuredFckMpa:   null,
        // Walzkurven-Schätzung (CEM I 42,5, A=31, n=0,67) bei w/b = 0,42
        //   (0,5 l Wasser + 60 % des Fließmittels auf 1,25 kg Zement):
        //   fcm = 31 × (1/0,42)^0,67 ≈ 55 → fck ≈ 47 N/mm². Konservativ 45.
        estimatedFckMpa: 45,
    },
];

/**
 * @param {string} key
 * @returns {UhpcPreset | null}
 */
export function getUhpcPreset(key) {
    return UHPC_PRESETS.find(p => p.key === key) || null;
}
