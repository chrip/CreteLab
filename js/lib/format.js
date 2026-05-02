// format.js — shared number/quantity formatting for the DIY-facing pages
// (fine-tune, UHPC). The B20 main page uses a different precision policy
// in js/app.js (formatQuantity/formatNumber) — kept separate on purpose
// so that engineering-style precision and DIY-style precision can evolve
// independently.

/**
 * Locale-aware number formatter (de-DE: comma decimal, dot thousands).
 *
 * @param {number} n         The number to format.
 * @param {number} [decimals=0]  Fixed number of fraction digits.
 * @returns {string}
 */
export function fmt(n, decimals = 0) {
    return n.toLocaleString('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * Render a quantity with an automatically chosen unit and precision tuned
 * for hobby-DIY users. Below 1 kg/l we switch to g/ml so users don't see
 * misleading values like "0,2 l" when "200 ml" reads more naturally.
 *
 * Policy:
 *   - kg, n < 1     → g  (no decimals)
 *   - l,  n < 1     → ml (no decimals)
 *   - kg/l otherwise → 2 decimals
 *
 * @param {number} n     Magnitude in the *base* unit (kg or l).
 * @param {('kg'|'l')} unit
 * @returns {string}     e.g. "30,00 kg", "190 ml", "1,23 l".
 */
export function fmtQty(n, unit) {
    if (unit === 'kg' && n < 1) return `${fmt(n * 1000)} g`;
    if (unit === 'l'  && n < 1) return `${fmt(n * 1000)} ml`;
    return `${fmt(n, 2)} ${unit}`;
}

/**
 * Parse a German-style decimal string (comma or dot) into a number.
 * Returns NaN for invalid input — callers decide on fallback behavior.
 *
 * @param {string} raw
 * @returns {number}
 */
export function parseDecimal(raw) {
    if (raw === null || raw === undefined) return NaN;
    return parseFloat(String(raw).replace(',', '.'));
}
