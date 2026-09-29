// describe-app.js - UI for describe.html: text -> Laya facts -> B20 recipe
import { factsToValues, chooseDiyPreset, detectApproach, fineTuneOptions, DIY_DEFAULT_VOLUME_M3 } from './lib/describe.js';
import { fineTunePresetFor, bagMixKg, BAG_KG, WATERPROOF_PCT } from './lib/fine-tune-presets.js';
import { getAdmixtureDosage, applyAdmixtureWaterReduction } from './lib/additives.js';
import { standardUrl, fineTuneUrl, uhpcUrl } from './lib/handoff.js';
import { resolveVolume, wallFromAnswers } from './lib/volume.js';

// Measurements the server found in the current description (describe/measurements.py)
let currentCandidates = [];
import { computeRecipe } from './lib/recipe.js';
import { getUhpcPreset } from './lib/uhpc-presets.js';
import { computeUhpcRecipe } from './lib/uhpc-engine.js';
import { i18n } from './lib/i18n.js';

const STRINGS = {
    de: {
        'tagline': 'Beschreiben Sie Ihr Projekt – wir berechnen den Beton',
        'nav.describe': 'Projekt beschreiben', 'nav.calculator': 'Betonrechner',
        'nav.finetune': 'Rezept feintunen', 'nav.uhpc': 'Hochleistungsbeton',
        'input.label': 'Projektbeschreibung',
        'input.button': 'Rezept berechnen', 'input.busy': 'Denke nach …',
        'examples': 'Beispiele:',
        'ex.1': 'Fundament für ein Gartenhaus 3x2 m, 20 cm dick', 'ex.2': 'Zaunpfosten einbetonieren',
        'ex.3': 'Kellerwände im Grundwasser', 'ex.4': 'Blumenkübel für den Balkon, Wandstärke 2 cm',
        'facts.title': 'Das haben wir verstanden', 'classes.title': 'Anforderungen', 'recipe.title': 'Rezept',
        'recipe.material': 'Stoff', 'recipe.perm3': 'pro m³', 'recipe.total': 'für {vol} m³',
        'disclaimer': 'Automatische Einschätzung aus Ihrer Beschreibung. Prüfen Sie die erkannten Angaben – für tragende Bauteile gehört das Rezept in die Hände einer Fachkraft.',
        'title': '{strength} · {classes} · {vol} m³',
        'volume.volume': 'Menge aus Ihrer Angabe „{match}“.',
        'volume.dimensions': 'Menge berechnet aus „{match}“.',
        'volume.hollow.one': 'Menge berechnet aus „{match}“ als Hohlkörper mit einer offenen Seite zum Gießen und Ausschalen.',
        'volume.laya': 'Menge berechnet als {shape}: {detail}.',
        'shape.slab': 'Platte', 'shape.block': 'Quader', 'shape.cube': 'Würfel', 'shape.cylinder': 'Zylinder',
        'shape.hollow': 'Hohlkörper', 'shape.ring': 'Ring/Rohr', 'shape.bowl': 'Schale', 'shape.unknown': 'Körper',
        'role.length': 'Länge/Kante', 'role.width': 'Breite', 'role.height': 'Höhe/Tiefe', 'role.diameter': 'Durchmesser',
        'role.wall': 'Wand', 'role.thickness': 'Dicke', 'role.area': 'Fläche', 'role.volume': 'Menge', 'role.count': 'Stück',
        'open.one': 'eine Seite offen', 'open.none': 'allseitig geschlossen', 'open.both': 'oben und unten offen', 'open.solid': 'massiv',
        'volume.hollow.none': 'Menge berechnet aus „{match}“ als allseitig geschlossener Hohlkörper.',
        'volume.hollow.both': 'Menge berechnet aus „{match}“ als Hohlkörper, oben und unten offen.',
        'volume.default': 'Keine Menge erkannt – gerechnet für 1 m³. Nennen Sie Maße (z. B. „3x2 m, 20 cm dick“) oder eine Menge (z. B. „2 m³“).',
        'model': 'Erkannt mit {model} in {ms} ms.',
        'error.server': 'Die Beschreibung konnte nicht ausgewertet werden ({status}).',
        'error.engine': 'Für diese Anforderungen konnte kein Rezept berechnet werden ({key}).',
        'fact.indoor_dry': 'innen, trocken', 'fact.rain': 'Regen / Spritzwasser', 'fact.ground': 'Erdkontakt',
        'fact.frost': 'Frost', 'fact.deicing_salt': 'Tausalz', 'fact.horizontal': 'waagerechte Fläche',
        'fact.reinforced': 'bewehrt', 'fact.watertight': 'wasserundurchlässig',
        'traffic.0': 'kein Verkehr', 'traffic.1': 'begehbar', 'traffic.2': 'befahrbar (Pkw)', 'traffic.3': 'Schwerverkehr / Stapler',
        'element.foundation': 'Fundament', 'element.slab': 'Platte / Boden', 'element.wall': 'Wand / Stütze / Treppe',
        'element.paving': 'Verkehrsfläche', 'element.small': 'Kleinteil / Pfosten',
        'unsure': 'unsicher',
        'reason.x0': 'X0 – unbewehrt, kein Frost, kein Verschleiß: kein Angriff.',
        'reason.xc1': 'XC1 – bewehrt, trocken innen.',
        'reason.xc2': 'XC2 – bewehrt, ständig feucht / Erdkontakt.',
        'reason.xc3': 'XC3 – bewehrt, mäßig feucht, vor Regen geschützt.',
        'reason.xc4': 'XC4 – bewehrt, wechselnd nass und trocken (Regen).',
        'reason.xd1': 'XD1 – bewehrt, Sprühnebel mit Tausalz.',
        'reason.xd3': 'XD3 – bewehrt, Tausalz auf waagerechter Fläche.',
        'reason.xf1': 'XF1 – Frost ohne Taumittel, senkrechte Fläche.',
        'reason.xf2': 'XF2 – Frost mit Taumittel, senkrechte Fläche.',
        'reason.xf3': 'XF3 – Frost ohne Taumittel, waagerechte Fläche.',
        'reason.xf4': 'XF4 – Frost mit Taumittel, waagerechte Fläche.',
        'reason.xm1': 'XM1 – mäßiger Verschleiß durch Pkw.',
        'reason.xm2': 'XM2 – starker Verschleiß (Stapler, Lkw).',
        'reason.lp': 'Luftporenbildner (LP) für den Frost-Tausalz-Widerstand.',
        'reason.wu': 'Dichtungsmittel für wasserundurchlässigen Beton – WU-Beton zusätzlich fachgerecht planen.',
        'mat.cement': 'Zement {type}', 'mat.water': 'Wasser gesamt', 'mat.zugabe': 'davon Zugabewasser',
        'mat.aggregate': 'Gesteinskörnung {sieb} (trocken)', 'mat.group': '  Korngruppe {range} mm',
        'mat.air': 'Luftporenbildner (Ziel {pct} % Luft)', 'mat.waterproof': 'Dichtungsmittel',
        'mat.wz': 'w/z-Wert',
        'fact.fine_cast': 'DIY-Stück (Feinbeton)',
        'diy.title': '{label} · {vol}',
        'volume.default.diy': 'Keine Größe erkannt – gerechnet für 10 Liter. Nennen Sie Maße (z. B. „Tischplatte 120x60x3 cm“) oder eine Menge (z. B. „5 Liter“).',
        'diy.outdoor': 'Für draußen: die Quelle beschreibt diese Mischung als witterungsbeständig (versiegelt mit Imprägnierung und Wachs).',
        'diy.small': 'Kleine Menge: Mischung für kleine Dekostücke, von Hand angemischt.',
        'diy.furniture': 'Feinbeton für Möbel und Dekostücke mit 1–2,5 cm Wandstärke.',
        'diy.source': 'Rezept nach: {title} ({author})',
        'diy.strength': 'Geschätzte Druckfestigkeit nach 28 Tagen: ca. {fck} N/mm² (Schätzung, von der Quelle nicht gemessen).',
        'diy.steps': 'So wird gemischt',
        'diy.more': 'Weitere Feinbeton-Rezepte im Hochleistungsbeton-Rechner.',
        'diy.mat.cement': 'Zement', 'diy.mat.sand': 'Sand', 'diy.mat.quartz': 'Quarzmehl',
        'diy.mat.fines': 'Kalksteinmehl / Feinstoffe', 'diy.mat.microsilica': 'Mikrosilica',
        'diy.mat.water': 'Wasser', 'diy.mat.pce': 'Fließmittel', 'diy.mat.fibres': 'Glasfasern',
        'recipe.perl': 'pro Liter', 'recipe.total.l': 'für {vol} l', 'recipe.total.any': 'für {vol}',
        'bagged.title': 'Fertigmischung {klasse} verfeinern · {vol}',
        'bagged.reason.base': 'Basis: Trockenbeton {klasse} aus dem Baumarkt – im Sack sind Zement, Sand und Kies schon gemischt.',
        'bagged.reason.extraCement': 'Etwas mehr Zement (10 %) für mehr Festigkeit.',
        'bagged.reason.wu': 'Dichtungsmittel, weil das Bauteil nass wird oder Wasser halten soll.',
        'bagged.reason.lp': 'Luftporenbildner, weil das Bauteil draußen Frost abbekommt.',
        'bagged.reason.bv': 'Betonverflüssiger für eine fließfähigere Mischung.',
        'mat.bag': 'Fertigmischung {klasse} (≈ {bags} Sack à {bag} kg)', 'mat.extra.cement': 'zusätzlicher Zement',
        'mat.wu.add': 'Dichtungsmittel', 'mat.bv.add': 'Betonverflüssiger', 'mat.lp.add': 'Luftporenbildner',
        'action.edit.standard': 'Rezept bearbeiten', 'action.edit.finetune': 'Rezept bearbeiten',
        'action.edit.uhpc': 'Rezept bearbeiten',
        'action.alt.finetune': 'Lieber mit Fertigmischung aus dem Baumarkt',
        'action.alt.standard': 'Von Grund auf mischen (Betonrechner)',
        'action.warn.thin': 'Nur ab ca. 3 cm Wandstärke geeignet – für dünnere Wände bleiben Sie beim Feinbeton.'
    },
    en: {
        'tagline': 'Describe your project – we calculate the concrete',
        'nav.describe': 'Describe project', 'nav.calculator': 'Concrete calculator',
        'nav.finetune': 'Fine-tune recipe', 'nav.uhpc': 'High-performance concrete',
        'input.label': 'Project description',
        'input.button': 'Calculate recipe', 'input.busy': 'Thinking …',
        'examples': 'Examples:',
        'ex.1': 'Garden shed foundation 3x2 m, 20 cm thick', 'ex.2': 'Setting fence posts in concrete',
        'ex.3': 'Basement walls in groundwater', 'ex.4': 'Garage floor, 6 x 3 m, 12 cm thick',
        'facts.title': 'What we understood', 'classes.title': 'Requirements', 'recipe.title': 'Recipe',
        'recipe.material': 'Material', 'recipe.perm3': 'per m³', 'recipe.total': 'for {vol} m³',
        'disclaimer': 'Automatic estimate from your description. Check the detected facts – for load-bearing parts, have the recipe reviewed by a professional.',
        'title': '{strength} · {classes} · {vol} m³',
        'volume.volume': 'Volume from your input “{match}”.',
        'volume.dimensions': 'Volume calculated from “{match}”.',
        'volume.hollow.one': 'Volume calculated from “{match}” as a hollow body with one open side for pouring and demoulding.',
        'volume.laya': 'Volume calculated as a {shape}: {detail}.',
        'shape.slab': 'slab', 'shape.block': 'block', 'shape.cube': 'cube', 'shape.cylinder': 'cylinder',
        'shape.hollow': 'hollow body', 'shape.ring': 'ring or pipe', 'shape.bowl': 'bowl', 'shape.unknown': 'piece',
        'role.length': 'length/edge', 'role.width': 'width', 'role.height': 'height/depth', 'role.diameter': 'diameter',
        'role.wall': 'wall', 'role.thickness': 'thickness', 'role.area': 'area', 'role.volume': 'amount', 'role.count': 'pieces',
        'open.one': 'one side open', 'open.none': 'closed on all sides', 'open.both': 'open at both ends', 'open.solid': 'solid',
        'volume.hollow.none': 'Volume calculated from “{match}” as a hollow body closed on all sides.',
        'volume.hollow.both': 'Volume calculated from “{match}” as a hollow body open at both ends.',
        'volume.default': 'No volume found – calculated for 1 m³. Give dimensions (e.g. “3x2 m, 20 cm thick”) or a volume (e.g. “2 m³”).',
        'model': 'Detected with {model} in {ms} ms.',
        'error.server': 'The description could not be analysed ({status}).',
        'error.engine': 'No recipe could be calculated for these requirements ({key}).',
        'fact.indoor_dry': 'indoors, dry', 'fact.rain': 'rain / splash water', 'fact.ground': 'ground contact',
        'fact.frost': 'frost', 'fact.deicing_salt': 'de-icing salt', 'fact.horizontal': 'horizontal surface',
        'fact.reinforced': 'reinforced', 'fact.watertight': 'watertight',
        'traffic.0': 'no traffic', 'traffic.1': 'foot traffic', 'traffic.2': 'cars', 'traffic.3': 'heavy / forklifts',
        'element.foundation': 'foundation', 'element.slab': 'slab / floor', 'element.wall': 'wall / column / stairs',
        'element.paving': 'paving', 'element.small': 'small part / post',
        'unsure': 'unsure',
        'reason.x0': 'X0 – unreinforced, no frost, no wear: no attack.',
        'reason.xc1': 'XC1 – reinforced, dry indoors.',
        'reason.xc2': 'XC2 – reinforced, permanently wet / ground contact.',
        'reason.xc3': 'XC3 – reinforced, moderately humid, sheltered from rain.',
        'reason.xc4': 'XC4 – reinforced, cyclic wet and dry (rain).',
        'reason.xd1': 'XD1 – reinforced, spray with de-icing salt.',
        'reason.xd3': 'XD3 – reinforced, de-icing salt on a horizontal surface.',
        'reason.xf1': 'XF1 – frost without de-icing agent, vertical surface.',
        'reason.xf2': 'XF2 – frost with de-icing agent, vertical surface.',
        'reason.xf3': 'XF3 – frost without de-icing agent, horizontal surface.',
        'reason.xf4': 'XF4 – frost with de-icing agent, horizontal surface.',
        'reason.xm1': 'XM1 – moderate wear from cars.',
        'reason.xm2': 'XM2 – heavy wear (forklifts, trucks).',
        'reason.lp': 'Air-entraining agent (LP) for freeze-thaw and de-icing salt resistance.',
        'reason.wu': 'Waterproofing admixture – plan watertight (WU) concrete properly as well.',
        'mat.cement': 'Cement {type}', 'mat.water': 'Total water', 'mat.zugabe': 'of which added water',
        'mat.aggregate': 'Aggregate {sieb} (dry)', 'mat.group': '  Grain group {range} mm',
        'mat.air': 'Air-entraining agent (target {pct} % air)', 'mat.waterproof': 'Waterproofing admixture',
        'mat.wz': 'w/c ratio',
        'fact.fine_cast': 'DIY piece (fine mortar)',
        'diy.title': '{label} · {vol}',
        'volume.default.diy': 'No size found – calculated for 10 litres. Give dimensions (e.g. “table top 120x60x3 cm”) or an amount (e.g. “5 litres”).',
        'diy.outdoor': 'For outdoor use: the source describes this mix as weather-resistant (sealed with impregnation and wax).',
        'diy.small': 'Small amount: a mix for small decorative pieces, mixed by hand.',
        'diy.furniture': 'Fine mortar for furniture and decorative pieces with 1–2.5 cm walls.',
        'diy.source': 'Recipe after: {title} ({author})',
        'diy.strength': 'Estimated 28-day compressive strength: approx. {fck} N/mm² (estimate, not measured by the source).',
        'diy.steps': 'How to mix',
        'diy.more': 'More fine-mortar recipes in the high-performance concrete calculator.',
        'diy.mat.cement': 'Cement', 'diy.mat.sand': 'Sand', 'diy.mat.quartz': 'Quartz flour',
        'diy.mat.fines': 'Limestone flour / fines', 'diy.mat.microsilica': 'Microsilica',
        'diy.mat.water': 'Water', 'diy.mat.pce': 'Superplasticizer', 'diy.mat.fibres': 'Glass fibres',
        'recipe.perl': 'per litre', 'recipe.total.l': 'for {vol} l', 'recipe.total.any': 'for {vol}',
        'bagged.title': 'Fine-tune a ready mix {klasse} · {vol}',
        'bagged.reason.base': 'Base: a bag of dry concrete mix {klasse} from the DIY store – cement, sand and gravel are already mixed in.',
        'bagged.reason.extraCement': 'A little more cement (10%) for more strength.',
        'bagged.reason.wu': 'Waterproofing admixture, because the piece gets wet or has to hold water.',
        'bagged.reason.lp': 'Air-entraining agent, because the piece gets frost outdoors.',
        'bagged.reason.bv': 'Plasticiser for a more flowable mix.',
        'mat.bag': 'Ready mix {klasse} (≈ {bags} bags of {bag} kg)', 'mat.extra.cement': 'extra cement',
        'mat.wu.add': 'Waterproofing admixture', 'mat.bv.add': 'Plasticiser', 'mat.lp.add': 'Air-entraining agent',
        'action.edit.standard': 'Edit recipe', 'action.edit.finetune': 'Edit recipe',
        'action.edit.uhpc': 'Edit recipe',
        'action.alt.finetune': 'Rather use a ready mix from the DIY store',
        'action.alt.standard': 'Mix from scratch (concrete calculator)',
        'action.warn.thin': 'Only works from about 3 cm wall thickness – for thinner walls stay with the fine mortar.'
    }
};

const lang = (() => {
    const p = new URLSearchParams(location.search).get('lang');
    if (p === 'de' || p === 'en') return p;
    return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
})();

function t(key, params = {}) {
    const s = STRINGS[lang][key] ?? STRINGS.de[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const fmt = (v, digits = 0) => Number(v).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB',
    { minimumFractionDigits: digits, maximumFractionDigits: digits });

const $ = id => document.getElementById(id);

function applyStaticStrings() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
}

function renderFacts(answers) {
    const items = [];
    for (const id of ['fine_cast', 'indoor_dry', 'rain', 'ground', 'frost', 'deicing_salt', 'horizontal', 'reinforced', 'watertight']) {
        const p = answers[id]?.noul ?? 0;
        const cls = p >= 0.65 ? 'yes' : p <= 0.35 ? 'no' : 'unsure';
        const hint = cls === 'unsure' ? ` (${t('unsure')})` : '';
        items.push(`<li class="${cls}" title="${fmt(p * 100)} %">${esc(t(`fact.${id}`))}${hint}</li>`);
    }
    items.push(`<li class="yes">${esc(t(`element.${answers.element?.choice}`))}</li>`);
    items.push(`<li class="yes">${esc(t(`traffic.${Math.round(answers.traffic?.score ?? 0)}`))}</li>`);
    $('factList').innerHTML = items.join('');
}

function renderRecipe(recipe, values, volume) {
    const m = recipe.materials;
    const rows = [
        [t('mat.cement', { type: values.cementType }), m.cement, 'kg'],
        [t('mat.water'), m.water, 'l'],
        [t('mat.zugabe'), m.zugabewasser, 'l'],
        [t('mat.aggregate', { sieb: values.siebline }), m.aggregate, 'kg'],
        ...(recipe.korngruppen || []).map(kg => [t('mat.group', { range: kg.range }), kg.massDry, 'kg'])
    ];
    if (values.useAirEntraining) rows.push([t('mat.air', { pct: fmt(values.airEntrainingPercent, 1) }), null, '']);
    if (m.waterproofing > 0) rows.push([t('mat.waterproof'), m.waterproofing, 'kg']);

    $('totalHeader').textContent = t('recipe.total', { vol: fmt(volume, volume < 10 ? 2 : 1) });
    // Scale the rounded per-m³ amounts, so both columns add up the same way.
    $('recipeRows').innerHTML = rows.map(([label, raw, unit]) => [label, raw === null ? null : Math.round(raw), unit]).map(([label, perM3, unit]) => `<tr>
        <td>${esc(label)}</td>
        <td>${perM3 === null ? '–' : `${fmt(perM3)} ${unit}`}</td>
        <td>${perM3 === null ? '–' : `${fmt(perM3 * volume)} ${unit}`}</td>
    </tr>`).join('') + `<tr><td>${esc(t('mat.wz'))}</td><td>${fmt(recipe.wzLimit, 2)}</td><td></td></tr>`;
}

let currentAnswers = {};

function volumeNote(vol, defaultKey) {
    if (vol.source === 'default') return t(defaultKey);
    if (vol.source === 'laya') {
        const parts = currentCandidates.map(c => {
            const role = currentAnswers[`role:${c}`]?.choice;
            const label = c.replace(/ #\d+$/, '');
            if (role === 'count') return label;   // "12 zaunpfosten" already says what is counted
            return role && role !== 'other' ? `${label} ${t(`role.${role}`)}` : c.includes('x') ? label : null;
        }).filter(Boolean);
        const open = vol.laya.shape === 'hollow' ? `, ${t(`open.${vol.laya.open || 'one'}`)}` : '';
        return t('volume.laya', { shape: t(`shape.${vol.laya.shape}`), detail: parts.join(' · ') + open });
    }
    if (vol.source === 'hollow') return t(`volume.hollow.${vol.open}`, { match: vol.match });
    return t(`volume.${vol.source}`, { match: vol.match });
}

function fmtAmount(kg, unit) {
    // Grams / millilitres below 1 kg or 1 l, like the high-performance concrete page.
    if (kg < 1) return `${fmt(kg * 1000)} ${unit === 'l' ? 'ml' : 'g'}`;
    return `${fmt(kg, 2)} ${unit}`;
}

function renderDiy(text, answers) {
    const vol = resolveVolume(text, answers, currentCandidates, { defaultVolume: DIY_DEFAULT_VOLUME_M3 });
    const { presetKey, reason } = chooseDiyPreset(answers, vol);
    const preset = getUhpcPreset(presetKey);
    const r = computeUhpcRecipe(preset, vol.volume);
    const litres = vol.volume * 1000;
    const label = i18n.t(`uhpc.preset.${preset.key}.label`);

    $('resultTitle').textContent = t('diy.title', { label, vol: `${fmt(litres, litres < 10 ? 1 : 0)} l` });
    $('volumeNote').textContent = volumeNote(vol, 'volume.default.diy');
    $('reasonList').innerHTML = [
        esc(t(reason.replace('describe.', ''))),
        `${esc(t('diy.source', { title: preset.source.title, author: preset.source.author }))} – <a href="${esc(preset.source.url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(preset.source.url).hostname)}</a>`,
        esc(t('diy.strength', { fck: fmt(preset.estimatedFckMpa ?? preset.airCuredFckMpa ?? preset.claimedFckMpa) }))
    ].map(li => `<li>${li}</li>`).join('');

    const rows = [
        [t('diy.mat.cement'), r.cementKg, 'kg'], [t('diy.mat.sand'), r.sandKg, 'kg'],
        [t('diy.mat.quartz'), r.quartzPowderKg, 'kg'], [t('diy.mat.fines'), r.finesKg, 'kg'],
        [t('diy.mat.microsilica'), r.microsilicaKg, 'kg'], [t('diy.mat.water'), r.waterL, 'l'],
        [t('diy.mat.pce'), r.superplasticizerL, 'l'], [t('diy.mat.fibres'), r.fibresG / 1000, 'kg']
    ].filter(([, v]) => v > 0);
    $('totalHeader').textContent = t('recipe.total.l', { vol: fmt(litres, litres < 10 ? 1 : 0) });
    document.querySelector('#describeResult thead th:nth-child(2)').textContent = t('recipe.perl');
    $('recipeRows').innerHTML = rows.map(([name, total, unit]) => `<tr>
        <td>${esc(name)}</td><td>${fmtAmount(total / litres, unit)}</td><td>${fmtAmount(total, unit)}</td></tr>`).join('');

    const vars = {
        cementKg: fmtAmount(r.cementKg, 'kg'), sandKg: fmtAmount(r.sandKg, 'kg'),
        quartzPowderKg: fmtAmount(r.quartzPowderKg, 'kg'), finesKg: fmtAmount(r.finesKg, 'kg'),
        microsilicaKg: fmtAmount(r.microsilicaKg, 'kg'), waterL: fmtAmount(r.waterL, 'l'),
        superplasticizerL: fmtAmount(r.superplasticizerL, 'l'), fibresG: fmtAmount(r.fibresG / 1000, 'kg')
    };
    const steps = preset.mixingSteps.map((step, i) => {
        const key = `uhpc.preset.${preset.key}.step.${i + 1}`;
        const translated = i18n.t(key);
        return (translated && translated !== key ? translated : step).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    });
    $('diySteps').innerHTML = `<h3>${esc(t('diy.steps'))}</h3><ol>${steps.map(st => `<li>${st}</li>`).join('')}</ol>`;
    return { vol, presetKey };
}

/**
 * "Ready-mix bag + additions": the fine-tune idea in plain words. Same numbers as
 * fine-tune.html (base mix per m³, 10 % extra cement, 2 % waterproofing, admixture dosages).
 */
function renderBagged(text, answers, mapped) {
    const small = answers.element?.choice === 'small';
    const vol = resolveVolume(text, answers, currentCandidates, { defaultVolume: small ? DIY_DEFAULT_VOLUME_M3 : 1 });
    const preset = fineTunePresetFor(mapped.values.strengthClass);
    const opts = fineTuneOptions(answers, text);
    const v = vol.volume;
    const mixKg = bagMixKg(preset, v);
    const bags = fmt(mixKg / BAG_KG, mixKg / BAG_KG < 10 ? 1 : 0);
    const volText = v < 0.1 ? `${fmt(v * 1000, v < 0.01 ? 1 : 0)} l` : `${fmt(v, 2)} m³`;

    $('resultTitle').textContent = t('bagged.title', { klasse: preset.klasse, vol: volText });
    $('volumeNote').textContent = volumeNote(vol, small ? 'volume.default.diy' : 'volume.default');
    $('reasonList').innerHTML = ['bagged.reason.base', ...opts.map(o => `bagged.reason.${o}`)]
        .map(k => `<li>${esc(t(k, { klasse: preset.klasse }))}</li>`).join('');

    let water = preset.w;
    if (opts.includes('bv')) water = applyAdmixtureWaterReduction(water, 'BV');
    const rows = [[t('mat.bag', { klasse: preset.klasse, bags, bag: BAG_KG }), preset.z + preset.g, 'kg']];
    if (opts.includes('extraCement')) rows.push([t('mat.extra.cement'), Math.round(preset.z * 0.10), 'kg']);
    if (opts.includes('wu')) rows.push([t('mat.wu.add'), preset.z * WATERPROOF_PCT / 100, 'kg']);
    if (opts.includes('bv')) rows.push([t('mat.bv.add'), getAdmixtureDosage('BV'), 'l']);
    if (opts.includes('lp')) rows.push([t('mat.lp.add'), getAdmixtureDosage('LP'), 'l']);
    rows.push([t('mat.water'), water, 'l']);
    $('totalHeader').textContent = t('recipe.total.any', { vol: volText });
    $('recipeRows').innerHTML = rows.map(([label, perM3, unit]) => `<tr>
        <td>${esc(label)}</td><td>${fmtAmount(perM3, unit)}</td><td>${fmtAmount(perM3 * v, unit)}</td></tr>`).join('');
    $('diySteps').innerHTML = '';
    return vol;
}

/** Buttons that open the matching form pre-filled, plus the alternatives with warnings. */
function renderActions(approach, { text, vol, mapped, answers, presetKey }) {
    const { values, exposureClasses } = mapped;
    const thin = (approach === 'fine_mortar' && !(vol.wall >= 0.03)) || (approach === 'bagged' && vol.wall > 0 && vol.wall < 0.03);
    const volume = vol.volume;
    const standard = standardUrl({ source: 'describe', text, volume, exposureClasses, ...values,
        airEntrainingPercent: values.useAirEntraining ? values.airEntrainingPercent : 0,
        waterproofPercent: values.useWaterproofing ? values.waterproofPercent : 0,
        warn: thin ? 'thin' : '' });
    const fineTune = fineTuneUrl({ source: 'describe', text, volume, exposureClasses,
        preset: fineTunePresetFor(values.strengthClass).value, opts: fineTuneOptions(answers, text), warn: thin ? 'thin' : '' });
    const uhpc = uhpcUrl({ source: 'describe', text, volume, preset: presetKey || chooseDiyPreset(answers, vol).presetKey });

    const buttons = {
        scratch: [['action.edit.standard', standard, true], ['action.alt.finetune', fineTune]],
        bagged: [['action.edit.finetune', fineTune, true, thin], ['action.alt.standard', standard, false, thin]],
        fine_mortar: [['action.edit.uhpc', uhpc, true], ['action.alt.finetune', fineTune, false, thin], ['action.alt.standard', standard, false, thin]]
    }[approach];
    $('describeActions').innerHTML = buttons.map(([key, href, primary, warn]) =>
        `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'} describe-action" href="${esc(href)}">${esc(t(key))}</a>` +
        (warn ? `<p class="form-hint describe-action-warn">⚠️ ${esc(t('action.warn.thin'))}</p>` : '')).join('');
}

async function run(text) {
    $('describeError').classList.add('hidden');
    const btn = $('describeBtn');
    btn.disabled = true;
    btn.textContent = t('input.busy');
    try {
        const res = await fetch('api/describe', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error(t('error.server', { status: res.status }));
        const { answers, model, ms, candidates = [] } = await res.json();
        currentCandidates = candidates;
        currentAnswers = answers;

        $('diySteps').innerHTML = '';
        document.querySelector('#describeResult thead th:nth-child(2)').textContent = t('recipe.perm3');
        renderFacts(answers);
        $('modelInfo').textContent = t('model', { model, ms: fmt(ms) });
        const approach = detectApproach(answers, text, { wall: wallFromAnswers(answers, candidates) });
        const mapped = factsToValues(answers);
        if (approach === 'fine_mortar') {
            const { vol, presetKey } = renderDiy(text, answers);
            renderActions(approach, { text, vol, mapped, answers, presetKey });
            $('describeResult').classList.remove('hidden');
            return;
        }
        if (approach === 'bagged') {
            const vol = renderBagged(text, answers, mapped);
            renderActions(approach, { text, vol, mapped, answers });
            $('describeResult').classList.remove('hidden');
            return;
        }

        const vol = resolveVolume(text, answers, currentCandidates);
        const { values, exposureClasses, reasons } = mapped;
        const result = computeRecipe({ volume: vol.volume, ...values }, exposureClasses);
        if (result.error) throw new Error(t('error.engine', { key: result.error }));

        $('resultTitle').textContent = t('title', {
            strength: values.strengthClass, classes: exposureClasses.join(' + '), vol: fmt(vol.volume, 2)
        });
        $('volumeNote').textContent = volumeNote(vol, 'volume.default');
        $('reasonList').innerHTML = reasons.map(r => `<li>${esc(t(r.replace('describe.', '')))}</li>`).join('');
        renderRecipe(result.recipe, values, vol.volume);
        renderActions(approach, { text, vol, mapped, answers });
        $('describeResult').classList.remove('hidden');
    } catch (e) {
        $('describeError').textContent = e.message;
        $('describeError').classList.remove('hidden');
        $('describeResult').classList.add('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = t('input.button');
    }
}

applyStaticStrings();
i18n.setLocale(lang).catch(() => {});  // preset labels and steps for the DIY route
$('describeForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('describeInput').value.trim();
    if (text) run(text);
});
// Enter searches like a search box; Shift+Enter starts a new line.
$('describeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        $('describeForm').requestSubmit();
    }
});
document.querySelectorAll('.describe-example').forEach(b => b.addEventListener('click', () => {
    $('describeInput').value = b.textContent;
    run(b.textContent);
}));
