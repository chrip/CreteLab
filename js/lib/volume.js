// volume.js - Concrete volume from Laya's answers: shape + role of each measurement
// Laya decides what each number means (describe/role_question.json) and which shape the
// piece has; these fixed formulas turn that into m³. Falls back to parseVolume().
import { parseVolume } from './describe.js';

const UNIT_TO_M = { mm: 0.001, cm: 0.01, dm: 0.1, m: 1 };
const num = s => parseFloat(String(s).replace(',', '.'));

/**
 * Read a candidate from describe/measurements.py back into numbers.
 * @returns {{kind: 'dims'|'length'|'area'|'volume'|'count', value?: number, size?: number[]}|null}
 */
export function parseCandidate(candidate) {
    const [value, unitRaw = ''] = candidate.replace(/ #\d+$/, '').split(' ');
    const unit = unitRaw.toLowerCase();
    if (value.includes('x')) {
        const factor = UNIT_TO_M[unit];
        return factor ? { kind: 'dims', size: value.split('x').map(v => num(v) * factor) } : null;
    }
    const n = num(value);
    if (!Number.isFinite(n)) return null;
    if (UNIT_TO_M[unit]) return { kind: 'length', value: n * UNIT_TO_M[unit] };
    if (['m²', 'm2', 'qm'].includes(unit)) return { kind: 'area', value: n };
    if (['m³', 'm3', 'cbm', 'kubik'].includes(unit)) return { kind: 'volume', value: n };
    if (['l', 'liter', 'litre'].includes(unit)) return { kind: 'volume', value: n / 1000 };
    return { kind: 'count', value: n };
}

const quarterPi = Math.PI / 4;

/**
 * Volume from shape and roles, or null when the answers are not enough.
 * @param {object} answers - Laya's answers incl. shape, open_sides and role:<candidate>
 * @param {string[]} candidates - measurements the server found (in reading order)
 */
/** Wall thickness in m from Laya's roles, or null. */
export function wallFromAnswers(answers, candidates = []) {
    for (const c of candidates) {
        const p = parseCandidate(c);
        if (p?.kind === 'length' && answers[`role:${c}`]?.choice === 'wall') return p.value;
    }
    return null;
}

export function volumeFromAnswers(answers, candidates = []) {
    let shape = answers.shape?.choice;
    // A wall thickness means a hollow piece, whatever shape was answered.
    if (wallFromAnswers(answers, candidates) && !['hollow', 'ring', 'bowl'].includes(shape)) shape = 'hollow';
    const open = answers.open_sides?.choice;
    const r = {};                // role -> metres (or m², m³, pieces)
    let dims = null;
    for (const c of candidates) {
        const p = parseCandidate(c);
        if (!p) continue;
        if (p.kind === 'dims') { dims ??= p.size; continue; }
        const role = answers[`role:${c}`]?.choice;
        if (!role || role === 'other' || r[role] !== undefined) continue;
        if (role === 'area' && p.kind !== 'area') continue;
        if (role === 'volume' && p.kind !== 'volume') continue;
        if (role === 'count' && p.kind !== 'count') continue;
        // "2 Säcke Fertigbeton" is how much mix is bought, not how many pieces are cast.
        if (role === 'count' && /säck|sack|bag/.test(c)) continue;
        if (['length', 'width', 'height', 'diameter', 'wall', 'thickness'].includes(role) && p.kind !== 'length') continue;
        r[role] = p.value;
    }
    if (r.volume) return { volume: r.volume, shape, detail: 'volume', parts: r };

    // Outer size: an LxW(xH) group first, then the single values.
    let [L, W, H] = dims ?? [];
    L ??= r.length; W ??= r.width; H ??= r.height ?? r.thickness;
    const D = r.diameter, t = r.wall, n = r.count || 1;
    let v = null;
    switch (shape) {
        case 'slab':
            if (r.area && (r.thickness || r.height)) v = r.area * (r.thickness || r.height);
            else if (dims?.length === 3) v = L * W * H;
            else if (L && W && (r.thickness || H)) v = L * W * (r.thickness || H);
            break;
        case 'block':
            if (L && W && H) v = L * W * H;
            else if (D && (H || L)) v = quarterPi * D * D * (H || L);   // a block with a diameter is round
            break;
        case 'cube': {
            const a = L ?? W ?? H;
            if (a) v = a ** 3;
            break;
        }
        case 'cylinder':
            if (D && (H || L)) v = quarterPi * D * D * (H || L);
            break;
        case 'hollow': {
            if (!t) break;
            const openFaces = open === 'none' ? 0 : open === 'both' ? 2 : 1;   // cast pieces: one side open by default
            const innerH = h => Math.max(0, h - (2 - openFaces) * t);
            if (D && (H || L)) {
                const h = H || L;
                v = quarterPi * D * D * h - quarterPi * Math.max(0, D - 2 * t) ** 2 * innerH(h);
            } else {
                const a = L ?? W ?? H;
                const [l, w, h] = [L ?? a, W ?? (dims ? undefined : a), H ?? (dims ? undefined : a)];
                if (l && w && h) v = l * w * h - Math.max(0, l - 2 * t) * Math.max(0, w - 2 * t) * innerH(h);
            }
            break;
        }
        case 'ring':
            if (D && t && (H || L)) v = quarterPi * (D * D - Math.max(0, D - 2 * t) ** 2) * (H || L);
            else if (L && W && H && t) v = H * (L * W - Math.max(0, L - 2 * t) * Math.max(0, W - 2 * t));
            break;
        case 'bowl':
            if (D && t) { const R = D / 2; v = (2 / 3) * Math.PI * (R ** 3 - Math.max(0, R - t) ** 3); }
            break;
    }
    if (!(v > 0)) return null;
    return { volume: v * n, shape, open, count: n, parts: { L, W, H, D, t, ...r } };
}

const round = v => (v < 0.1 ? Math.round(v * 1e4) / 1e4 : Math.round(v * 100) / 100);

/**
 * The volume for the page: Laya's shape and roles where they are enough, else the
 * regex parser. Result has the fields of parseVolume() plus `laya` for the note.
 */
export function resolveVolume(text, answers, candidates, { defaultVolume = 1 } = {}) {
    const fromLaya = volumeFromAnswers(answers, candidates);
    if (fromLaya) {
        return {
            volume: Math.max(0.0001, round(fromLaya.volume)), source: 'laya', laya: fromLaya,
            wall: fromLaya.parts.t, open: fromLaya.open, match: candidates.join(' · ')
        };
    }
    return parseVolume(text, { defaultVolume });
}
