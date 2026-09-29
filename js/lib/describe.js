// describe.js - Turn a free-text project description into CreteLab form values
// Laya answers plain yes/no questions (describe/questions.json); the DIN 1045-2 logic
// that turns those facts into exposure classes lives here, where it can be reviewed.
import { getStrictestLimits } from './exposure.js';
import { getAvailableClasses, getStrengthClass } from './strength.js';

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNIT_TO_M = { mm: 0.001, cm: 0.01, dm: 0.1, m: 1 };

function num(s) {
    return parseFloat(s.replace(',', '.'));
}

/**
 * Find the concrete volume in a description.
 * Understands volumes ("2 m³", "3 Kubik", "halber Kubik", "500 Liter"), areas with a
 * thickness ("25 m², 15 cm stark") and dimensions ("3x2 m, 20 cm dick", "40x40x80 cm").
 * @param {string} text
 * @param {{defaultVolume?: number}} [opts] - m³ to assume when no size is given
 * @returns {{volume: number, source: 'volume'|'dimensions'|'hollow'|'default', match?: string,
 *            wall?: number, open?: 'one'|'none'|'both'}}
 */
export function parseVolume(text, { defaultVolume = 1 } = {}) {
    const t = text.toLowerCase();

    const vol = t.match(new RegExp(`${NUM}\\s*(m³|m3|cbm|kubikmeter|kubik|cubic met(?:er|re)s?)`));
    if (vol) return { volume: round(num(vol[1])), source: 'volume', match: vol[0] };
    if (/halbe[rn]?\s+kubik|half a cubic/.test(t)) return { volume: 0.5, source: 'volume', match: 'halber Kubik' };
    const litres = t.match(new RegExp(`${NUM}\\s*(l|liter|litre|liters|litres)\\b`));
    if (litres) return { volume: round(num(litres[1]) / 1000), source: 'volume', match: litres[0] };

    const hollow = parseHollowBody(t);
    if (hollow) return hollow;

    const thickness = t.match(new RegExp(
        `${NUM}\\s*(mm|cm|dm|m)\\s*(?:dick|stark|tief|hoch|höhe|dicke|thick|deep|high|thickness|depth)` +
        `|(?:dicke|stärke|tiefe|höhe|thickness|depth)\\s*(?:von\\s*|of\\s*)?${NUM}\\s*(mm|cm|dm|m)`));
    const thicknessM = thickness
        ? (thickness[1] ? num(thickness[1]) * UNIT_TO_M[thickness[2]] : num(thickness[3]) * UNIT_TO_M[thickness[4]])
        : null;

    const dims = parseDims(t);
    if (dims) {
        const lengths = dims.size;
        if (lengths.length === 3) return { volume: round(lengths[0] * lengths[1] * lengths[2]), source: 'dimensions', match: dims.match };
        if (thicknessM) return { volume: round(lengths[0] * lengths[1] * thicknessM), source: 'dimensions', match: `${dims.match} · ${thickness[0]}` };
    }

    const area = t.match(new RegExp(`${NUM}\\s*(m²|m2|qm|quadratmeter|square met(?:er|re)s?|sqm)`));
    if (area && thicknessM) {
        return { volume: round(num(area[1]) * thicknessM), source: 'dimensions', match: `${area[0]} · ${thickness[0]}` };
    }

    return { volume: defaultVolume, source: 'default' };
}

const LEN = String.raw`(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|m)\b`;
const DIMS_RE = new RegExp(`${NUM}\\s*(mm|cm|m)?\\s*[x×*]\\s*${NUM}\\s*(mm|cm|m)?(?:\\s*[x×*]\\s*${NUM}\\s*(mm|cm|m)?)?(?![a-zäöüß\\d])`);

/**
 * "3x2 m", "40x40x80 cm", "40 cm x 40 cm", "40x40x40": sizes in m and the matched text.
 * Without a unit, values from 10 up are read as cm (same rule as describe/measurements.py).
 */
function parseDims(t) {
    const m = t.match(DIMS_RE);
    if (!m) return null;
    const values = [m[1], m[3], m[5]].filter(Boolean).map(num);
    const unit = m[6] || m[4] || m[2] || (Math.min(...values) >= 10 ? 'cm' : 'm');
    return { size: values.map(v => v * UNIT_TO_M[unit]), match: m[0].trim() };
}

// Wall thickness, in the orders people write it. The bare word "Wand" only with mm/cm,
// so "Kellerwand 3 m hoch" is not read as a wall thickness.
const WALL_PATTERNS = [
    new RegExp(String.raw`(?:wand(?:stärke|staerke|dicke|icke)|materialstärke|wandung|wall\s*thickness)\s*(?:von\s*|of\s*)?` + LEN),
    new RegExp(String.raw`\b(?:wand|wall)\s*(?:von\s*|of\s*)?(\d+(?:[.,]\d+)?)\s*(mm|cm)\b`),
    new RegExp(LEN + String.raw`\s*(?:wand|wände|walls?)\b`)
];
function findWall(t) {
    for (const re of WALL_PATTERNS) {
        const m = t.match(re);
        if (m) return { text: m[0], meters: num(m[1]) * UNIT_TO_M[m[2]] };
    }
    return null;
}
const CUBE = /würfel|wuerfel|kubus|kubisch|cubisch|\bcube\b|\bcubic\b/;
const CLOSED = /geschlossen|\bclosed\b|rundum zu/;
const BOTH_OPEN = /\brohr|röhre|\bring\b|ohne boden|bottomless|\btube\b|\bpipe\b/;

/**
 * A cast DIY piece with a wall thickness is hollow. It needs an opening to pour and
 * demould, so by default one side is open (5 walls): a planter at the top, a seat cube
 * at the bottom — the volume is the same. "geschlossen" = 6 walls, Rohr/Ring = both ends open.
 * The open side is taken along the last dimension (the height).
 */
function parseHollowBody(t) {
    const wall = findWall(t);
    if (!wall) return null;
    const wallM = wall.meters;

    let outer = null;
    const dims = parseDims(t);
    if (dims?.size.length === 3) {
        outer = dims;
    } else if (CUBE.test(t)) {
        // The edge length: the largest length in the text that is not the wall thickness.
        const lengths = [...t.replace(wall.text, ' ').matchAll(new RegExp(LEN, 'g'))];
        if (lengths.length) {
            const best = lengths.reduce((a, b) => (num(b[1]) * UNIT_TO_M[b[2]] > num(a[1]) * UNIT_TO_M[a[2]] ? b : a));
            const a = num(best[1]) * UNIT_TO_M[best[2]];
            outer = { size: [a, a, a], match: best[0] };
        }
    }
    if (!outer) return null;

    const [l, w, h] = outer.size;
    const open = CLOSED.test(t) ? 'none' : BOTH_OPEN.test(t) ? 'both' : 'one';
    const innerH = open === 'none' ? h - 2 * wallM : open === 'one' ? h - wallM : h;
    const inner = Math.max(0, l - 2 * wallM) * Math.max(0, w - 2 * wallM) * Math.max(0, innerH);
    return { volume: round(l * w * h - inner), source: 'hollow', match: `${outer.match} · ${wall.text}`, wall: wallM, open };
}

// Two decimals for site volumes; litre precision below 0.1 m³ (DIY pieces).
function round(v) {
    const digits = v < 0.1 ? 4 : 2;
    return Math.max(0.0001, Math.round(v * 10 ** digits) / 10 ** digits);
}

/** Volume assumed for a DIY piece without a size (10 l). */
export const DIY_DEFAULT_VOLUME_M3 = 0.01;

/** True when Laya reads the description as a fine-mortar DIY piece rather than site concrete. */
export function isDiyPiece(answers) {
    return (answers.fine_cast?.noul ?? 0) >= 0.5;
}

/**
 * Pick a fine-mortar preset (js/lib/uhpc-presets.js) for a DIY piece.
 * @param {object} answers - Laya's answers
 * @param {{volume: number, source: string}} vol - result of parseVolume()
 * @returns {{presetKey: string, reason: string}} reason is an i18n key
 */
export function chooseDiyPreset(answers, vol) {
    const yes = id => (answers[id]?.noul ?? 0) >= 0.5;
    // Only this source states outdoor suitability ("witterungsbeständig").
    if ((yes('rain') || yes('frost')) && !yes('indoor_dry')) {
        return { presetKey: 'diy-white-15kg-laminate', reason: 'describe.diy.outdoor' };
    }
    if (vol.source !== 'default' && vol.volume <= 0.005) {
        return { presetKey: 'diy-white-bowl-4kg', reason: 'describe.diy.small' };
    }
    return { presetKey: 'diy-pce-30l-batch', reason: 'describe.diy.furniture' };
}

/**
 * Map Laya's answers to CreteLab form values.
 * @param {object} answers - Laya's `answers` object for the questions in describe/questions.json
 * @returns {{values: object, exposureClasses: string[], reasons: string[]}}
 *   `reasons` are i18n keys explaining each decision.
 */
export function factsToValues(answers) {
    const yes = id => (answers[id]?.noul ?? 0) >= 0.5;
    const traffic = Math.round(answers.traffic?.score ?? 0);
    const element = answers.element?.choice ?? 'slab';

    const f = {
        indoor: yes('indoor_dry') && !yes('rain'),
        rain: yes('rain'),
        ground: yes('ground'),
        frost: yes('frost'),
        salt: yes('deicing_salt'),
        horizontal: yes('horizontal'),
        reinforced: yes('reinforced'),
        watertight: yes('watertight')
    };
    const classes = [];
    const reasons = [];

    // Carbonation-induced corrosion only matters for reinforced concrete (DIN 1045-2, Tab. 1).
    if (f.reinforced) {
        if (f.rain) { classes.push('XC4'); reasons.push('describe.reason.xc4'); }
        else if (f.ground || f.watertight) { classes.push('XC2'); reasons.push('describe.reason.xc2'); }
        else if (f.indoor) { classes.push('XC1'); reasons.push('describe.reason.xc1'); }
        else { classes.push('XC3'); reasons.push('describe.reason.xc3'); }

        if (f.salt) {
            classes.push(f.horizontal ? 'XD3' : 'XD1');
            reasons.push(f.horizontal ? 'describe.reason.xd3' : 'describe.reason.xd1');
        }
    }

    if (f.frost && !f.indoor) {
        const cls = f.salt ? (f.horizontal ? 'XF4' : 'XF2') : (f.horizontal ? 'XF3' : 'XF1');
        classes.push(cls);
        reasons.push(`describe.reason.${cls.toLowerCase()}`);
    }

    if (traffic >= 3) { classes.push('XM2'); reasons.push('describe.reason.xm2'); }
    else if (traffic === 2 && f.horizontal) { classes.push('XM1'); reasons.push('describe.reason.xm1'); }

    // Unreinforced, no frost, no wear: no attack (DIN 1045-2 allows X0 only for plain concrete).
    if (classes.length === 0) {
        classes.push('X0');
        reasons.push('describe.reason.x0');
    }

    // XF2–XF4 get air entrainment (LP), the usual choice for frost/de-icing salt exposure.
    const needsAir = classes.some(c => ['XF2', 'XF3', 'XF4'].includes(c));
    const fine = element === 'wall' || element === 'small';
    const siebline = fine ? 'B16' : 'B32';
    if (needsAir) reasons.push('describe.reason.lp');
    if (f.watertight) reasons.push('describe.reason.wu');

    return {
        exposureClasses: classes,
        reasons,
        values: {
            strengthClass: minimumStrengthClass(classes, f.reinforced ? 'C20/25' : 'C16/20', needsAir),
            siebline,
            consistencyClass: element === 'paving' ? 'F2' : 'F3',
            aggregateType: 'Kiessand (Quarz)',
            cementType: 'CEM I 42.5 N',
            vorhaltemas: 9,  // B 20 section 6.2: standard deviation unknown
            admixtureType: 'none',
            useAirEntraining: needsAir,
            airEntrainingPercent: needsAir ? (fine ? 4.5 : 4.0) : 0,
            useFlyAsh: false, flyAshPercent: 0,
            useSilicaFume: false, silicaFumePercent: 0,
            useWaterproofing: f.watertight,
            waterproofPercent: f.watertight ? 2 : 0,
            useMoisture: false, moisture0_2: 5, moisture2_8: 3, moisture8plus: 2
        }
    };
}

/**
 * Lowest strength class that meets every exposure class. XF2/XF3 get their LP limits
 * when the mix is air-entrained (the air content set above meets the minimum).
 */
function minimumStrengthClass(classes, floor, airEntrained) {
    const minCube = Math.max(getStrengthClass(floor).f_ck_cube, getStrictestLimits(classes, { airEntrained }).minFck);
    return getAvailableClasses().find(c => getStrengthClass(c).f_ck_cube >= minCube) || 'C50/60';
}

// ── Approach: mix from scratch, ready-mix bag + extras (fine-tune), or fine mortar ──

const BAGGED_WORDS = /fertigbeton|fertigmischung|trockenbeton|sackware|säcke?\b.*beton|beton.*säcke?\b|baumarkt|hornbach|bauhaus|\bobi\b|\btoom\b|home ?depot|lowe'?s|quikrete|sakrete|bag(?:s|ged)? of (?:concrete|mix)|bagged|premix|pre-mix|ready[- ]?mix(?:ed)? (?:bag|concrete)/;
const EXTRA_CEMENT_WORDS = /mehr zement|zement dazu|zement (?:hinzu|zugeben|untermischen)|etwas zement|extra cement|more cement|add(?:ing)? (?:some )?cement/;
const PLASTICIZER_WORDS = /fließfähig|flüssiger|verflüssiger|fließmittel|plastici[sz]er|superplastici[sz]er|more fluid|flowable/;

/**
 * How the user wants to make the concrete: 'scratch' (cement, sand and gravel bought
 * separately → calculator), 'bagged' (a ready-mix bag plus additions → fine-tune) or
 * 'fine_mortar' (thin DIY piece → UHPC / fine mortar page). Uses Laya's `approach`
 * answer when the model has it, otherwise the DIY answer and clear keywords.
 */
export function detectApproach(answers, text = '', { wall = null } = {}) {
    const choice = answers.approach?.choice;
    // Site concrete (8–32 mm aggregate) cannot make walls under about 3 cm.
    if (choice === 'scratch' && wall !== null && wall < 0.03) return 'fine_mortar';
    if (choice === 'scratch' || choice === 'bagged' || choice === 'fine_mortar') return choice;
    const t = text.toLowerCase();
    if (BAGGED_WORDS.test(t)) return 'bagged';
    return isDiyPiece(answers) ? 'fine_mortar' : 'scratch';
}

/** Fine-tune options for a description: waterproofing, air, extra cement, plasticiser. */
export function fineTuneOptions(answers, text = '') {
    const yes = id => (answers[id]?.noul ?? 0) >= 0.5;
    const t = text.toLowerCase();
    const opts = [];
    if (yes('add_cement') || EXTRA_CEMENT_WORDS.test(t)) opts.push('extraCement');
    if (yes('watertight')) opts.push('wu');
    if ((yes('frost') || yes('deicing_salt')) && !yes('indoor_dry')) opts.push('lp');
    if (yes('add_plasticizer') || PLASTICIZER_WORDS.test(t)) opts.push('bv');
    return opts;
}
