import { getAvailableClasses, getStrengthClass,
         calculateTargetStrengthWithMargin, calculateWzFromTargetStrength,
         getAvailableCementTypes, getCementType } from './lib/strength.js';
import { getAvailableExposureClasses, getGoverningExposureClass, getMaxWz, getExposureClass, satisfiesExposureRequirements, getStrictestLimits } from './lib/exposure.js';
import { getAvailableConsistencyClasses, calculateWaterDemand, adjustForAggregateType, SIEBLINIES } from './lib/consistency.js';
import { getAvailableAggregates, getAverageDensity } from './lib/densities.js';
import { applyAdmixtureWaterReduction, adjustForAirEntraining, calculateEquivalentWzWithBoth, getAdmixtureDosage, getRecommendedWaterSaving } from './lib/additives.js';
import { calculateFinesContent, checkFinesLimits, calculatePasteVolume, checkPasteRequirements, checkCemIFlyAshSilicaFume } from './lib/fines-content.js';
import { getFinesFraction, distributeAggregateBySiebline, calculateZugabewasser, GRAIN_GROUPS_BY_SIEBLINE } from './lib/aggregate-gradation.js';
import { i18n } from './lib/i18n.js';

const AGGREGATE_KEYS = {
    'Kiessand (Quarz)':   'agg.kiessand',
    'Granit':             'agg.granit',
    'Dichter Kalkstein':  'agg.kalkstein',
    'Basalt':             'agg.basalt',
    'Betonsplitt':        'agg.betonsplitt',
    'Bauwerksplitt':      'agg.bauwerksplitt',
    'Blähton':            'agg.blahton',
    'Naturbims':          'agg.naturbims',
    'Hüttenbims':         'agg.huettenbims',
    'Baryt (Schwerspat)': 'agg.baryt',
    'Magnetit':           'agg.magnetit',
    'Hämatit':            'agg.haematit'
};

const STRENGTH_CLASS_KEYS = {
    'C8/10':    'strength.C8_10',
    'C12/15':   'strength.C12_15',
    'C16/20':   'strength.C16_20',
    'C20/25':   'strength.C20_25',
    'C25/30':   'strength.C25_30',
    'C30/37':   'strength.C30_37',
    'C35/45':   'strength.C35_45',
    'C40/50':   'strength.C40_50',
    'C45/55':   'strength.C45_55',
    'C50/60':   'strength.C50_60',
    'C55/67':   'strength.C55_67',
    'C60/75':   'strength.C60_75',
    'C70/85':   'strength.C70_85',
    'C80/95':   'strength.C80_95',
    'C90/105':  'strength.C90_105',
    'C100/115': 'strength.C100_115'
};

const SIEBLINE_KEYS = {
    'A8':    'sieb.A8',
    'B8':    'sieb.B8',
    'C8':    'sieb.C8',
    'A16':   'sieb.A16',
    'B16':   'sieb.B16',
    'C16':   'sieb.C16',
    'A/B16': 'sieb.A_B16',
    'A32':   'sieb.A32',
    'B32':   'sieb.B32',
    'C32':   'sieb.C32',
    'A/B32': 'sieb.A_B32'
};

const SIEBLINE_HINT_KEYS = {
    '8':  'sieb.hint.8',
    '16': 'sieb.hint.16',
    '32': 'sieb.hint.32'
};

const CONSISTENCY_KEYS = {
    'C0': 'cons.C0',
    'F1': 'cons.F1',
    'F2': 'cons.F2',
    'F3': 'cons.F3',
    'F4': 'cons.F4',
    'F5': 'cons.F5',
    'F6': 'cons.F6'
};

const CONSISTENCY_HINT_KEYS = {
    'C0': 'cons.hint.C0',
    'F1': 'cons.hint.F1',
    'F2': 'cons.hint.F2',
    'F3': 'cons.hint.F3',
    'F4': 'cons.hint.F4',
    'F5': 'cons.hint.F5',
    'F6': 'cons.hint.F6'
};

const CEMENT_TYPE_KEYS = {
    'CEM I 32.5 N':       'cem.CEM_I_32.5_N',
    'CEM I 42.5 N':       'cem.CEM_I_42.5_N',
    'CEM I 42.5 R':       'cem.CEM_I_42.5_R',
    'CEM I 52.5 N':       'cem.CEM_I_52.5_N',
    'CEM I 52.5 R':       'cem.CEM_I_52.5_R',
    'CEM II/A-S 42.5 N':  'cem.CEM_II_A_S_42.5_N',
    'CEM II/B-S 42.5 N':  'cem.CEM_II_B_S_42.5_N',
    'CEM II/A-LL 42.5 N': 'cem.CEM_II_A_LL_42.5_N',
    'CEM III/A 42.5 N':   'cem.CEM_III_A_42.5_N',
    'CEM III/B 42.5 N':   'cem.CEM_III_B_42.5_N'
};

const USE_CASES = {
    cheap:       { labelKey: 'index.usecase.cheap',       strength: 'C20/25', exposure: 'XC1', siebline: 'B32', consistency: 'F3', aggregateType: 'Kiessand (Quarz)', admixtureType: 'none', cementType: 'CEM I 42.5 N', vorhaltemas: 3 },
    standard:    { labelKey: 'index.usecase.standard',    strength: 'C25/30', exposure: 'XC2', siebline: 'B32', consistency: 'F3', aggregateType: 'Kiessand (Quarz)', admixtureType: 'none', cementType: 'CEM I 42.5 N', vorhaltemas: 3 },
    strong:      { labelKey: 'index.usecase.strong',      strength: 'C30/37', exposure: 'XC3', siebline: 'B16', consistency: 'F3', aggregateType: 'Betonsplitt', admixtureType: 'BV',   cementType: 'CEM I 42.5 N', vorhaltemas: 5 },
    ultraStrong: { labelKey: 'index.usecase.ultrastrong', strength: 'C40/50', exposure: 'XF3', siebline: 'B16', consistency: 'F3', aggregateType: 'Betonsplitt', admixtureType: 'FM',   cementType: 'CEM I 52.5 R', vorhaltemas: 5 }
};

const elements = {
    useCase: document.getElementById('useCase'),
    volume: document.getElementById('volume'),
    strengthClass: document.getElementById('strengthClass'),
    exposureClassContainer: document.getElementById('exposureClassContainer'),
    siebline: document.getElementById('siebline'),
    consistencyClass: document.getElementById('consistencyClass'),
    aggregateType: document.getElementById('aggregateType'),
    cementType: document.getElementById('cementType'),
    vorhaltemas: document.getElementById('vorhaltemas'),
    admixtureType: document.getElementById('admixtureType'),
    governingExposureInfo: document.getElementById('governingExposureInfo'),
    govClassCode: document.getElementById('govClassCode'),
    govClassDesc: document.getElementById('govClassDesc'),
    useAirEntraining: document.getElementById('useAirEntraining'),
    airEntrainingContainer: document.getElementById('airEntrainingContainer'),
    airEntrainingPercent: document.getElementById('airEntrainingPercent'),
    useFlyAsh: document.getElementById('useFlyAsh'),
    flyAshContainer: document.getElementById('flyAshContainer'),
    flyAshPercent: document.getElementById('flyAshPercent'),
    useSilicaFume: document.getElementById('useSilicaFume'),
    silicaFumeContainer: document.getElementById('silicaFumeContainer'),
    silicaFumePercent: document.getElementById('silicaFumePercent'),
    useWaterproofing: document.getElementById('useWaterproofing'),
    waterproofContainer: document.getElementById('waterproofContainer'),
    waterproofPercent: document.getElementById('waterproofPercent'),
    useMoisture: document.getElementById('useMoisture'),
    moistureContainer: document.getElementById('moistureContainer'),
    moisture0_2: document.getElementById('moisture0_2'),
    moisture2_8: document.getElementById('moisture2_8'),
    moisture8plus: document.getElementById('moisture8plus'),
    useCaseHint: document.getElementById('useCaseHint'),
    strengthHint: document.getElementById('strengthHint'),
    sieblinieHint: document.getElementById('sieblinieHint'),
    admixtureHint: document.getElementById('admixtureHint'),
    calculateBtn: document.getElementById('calculateBtn'),
    resultsSection: document.getElementById('results'),
    additivesSummary: document.getElementById('additivesSummary'),
    effectsList: document.getElementById('effectsList'),
    resStrength: document.getElementById('resStrength'),
    resVolume: document.getElementById('resVolume'),
    recipeBody: document.getElementById('recipeBody'),
    volumeColHeader: document.getElementById('volumeColHeader'),
    ingredientsHeader: document.getElementById('results-title'),
    calcStepsBody: document.getElementById('calcStepsBody'),
    calcDetails: document.getElementById('calcDetails'),
    kornGruppenSection: document.getElementById('kornGruppenSection'),
    kornGruppenBody: document.getElementById('kornGruppenBody'),
    zugabewasserInfo: document.getElementById('zugabewasserInfo'),
    instructionList: document.getElementById('instructionList')
};

let appState = {
    strengthClass: null,
    volume: 1,
    aggregateType: 'Kiessand (Quarz)',
    cementType: 'CEM I 42.5 N',
    vorhaltemas: 3,
    useFlyAsh: false,
    useSilicaFume: false,
    useWaterproofing: false,
    useAirEntraining: false,
    admixtureType: 'none'
};

function formatNumber(value, digits = 0) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    return i18n.formatNumber(Number(value), {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

/**
 * Dynamic formatter for quantities (kg, l) to avoid rounding errors in small volumes.
 * @param {number} value - The quantity to format
 * @param {string} unit - 'kg' or 'l'
 * @returns {string} Formatted string with appropriate precision
 */
function formatQuantity(value, unit) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    let val = Number(value);
    let displayUnit = unit;
    
    if (val === 0) return '0 ' + unit;

    // Unit conversion for human readability
    if (unit === 'kg' && val < 1) {
        val = val * 1000;
        displayUnit = 'g';
    } else if (unit === 'l' && val < 1) {
        val = val * 1000;
        displayUnit = 'ml';
    }

    // Dynamic precision based on the (possibly converted) value
    if (val < 0.1) {
        return i18n.formatNumber(val, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ' + displayUnit;
    } else if (val < 1) {
        return i18n.formatNumber(val, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + displayUnit;
    } else if (val < 10) {
        return i18n.formatNumber(val, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ' + displayUnit;
    } else {
        return i18n.formatNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + displayUnit;
    }
}

function setError(message) {
    clearError();
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    elements.resultsSection.parentNode.insertBefore(error, elements.resultsSection);
    elements.resultsSection.classList.add('hidden');
}

function clearError() {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
}

function evaluatePlausibility(state, recipe) {
    const warnings = [];

    const limits = recipe.strictLimits;
    if (limits) {
        const strengthMeta = getStrengthClass(state.strengthClass);
        if (strengthMeta && strengthMeta.f_ck_cube < limits.minFck) {
            warnings.push(i18n.t('warn.strength.too.low', { klasse: state.strengthClass, minFck: limits.minFck }));
        }

        if (recipe.materials.cement < limits.minZ) {
            warnings.push(i18n.t('warn.cement.below.min', { cement: formatNumber(recipe.materials.cement, 0), minZ: limits.minZ }));
        }

        if (limits.maxWz < Infinity) {
            const wzc = recipe.materials.water / recipe.materials.cement;
            if (wzc > limits.maxWz + 0.005) {
                warnings.push(i18n.t('warn.wz.exceeded', { wzc: wzc.toFixed(2), maxWz: limits.maxWz.toFixed(2) }));
            }
        }
    }

    // Paste volume check (Zementleimgehalt)
    const paste = calculatePasteVolume(recipe.materials.cement, recipe.materials.flyAsh, recipe.materials.silicaFume);
    if (paste && !checkPasteRequirements(paste, state.exposureClass).meetsRequirement) {
        warnings.push(i18n.t('warn.paste.too.low', { paste: formatNumber(paste.pasteVolume, 0), klasse: state.exposureClass }));
    }

    // Fines content check (Mehlkorngehalt) – including aggregate fines from sieve line
    const finesFromAggregate = recipe.materials.aggregate * getFinesFraction(state.siebline);
    const fines = calculateFinesContent({
        cement: recipe.materials.cement,
        flyAsh: recipe.materials.flyAsh,
        silicaFume: recipe.materials.silicaFume,
        fineAggregate0125: finesFromAggregate
    });
    if (fines) {
        const finesCheck = checkFinesLimits(fines, state.exposureClass);
        if (finesCheck && finesCheck.exceedsLimit) {
            warnings.push(i18n.t('warn.fines.too.high', { fines: formatNumber(fines.finesContent0125, 0), maxAllowed: finesCheck.maxAllowed, klasse: state.exposureClass }));
        }
    }

    // CEM I specific check for combined fly ash and silica fume
    if (recipe.materials.flyAsh > 0 && recipe.materials.silicaFume > 0) {
        const cemICheck = checkCemIFlyAshSilicaFume(recipe.materials.cement, recipe.materials.flyAsh, recipe.materials.silicaFume);
        if (!cemICheck.meetsLimit) {
            warnings.push(i18n.t('warn.flyash.silica'));
        }
    }

    if (state.useAirEntraining && state.airEntrainingPercent > 10) {
        warnings.push(i18n.t('warn.high.air', { pct: state.airEntrainingPercent }));
    }

    return warnings;
}

function buildSelectOptions(select, options, selectedValue, keyMap) {
    select.innerHTML = '';
    options.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = keyMap ? i18n.t(keyMap[value] || value) : label;
        if (value === selectedValue) option.selected = true;
        select.appendChild(option);
    });
}

function buildExposureCheckboxes() {
    const values = getAvailableExposureClasses();
    elements.exposureClassContainer.innerHTML = '';

    values.forEach(exposureCode => {
        const expLabel = i18n.t(`exp.${exposureCode}`) || exposureCode;
        const labelText = `${exposureCode} - ${expLabel}`;

        const wrapper = document.createElement('label');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.margin = '0 8px 4px 0';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'exposureClass';
        checkbox.value = exposureCode;
        checkbox.style.marginRight = '4px';
        checkbox.addEventListener('change', updateGoverningExposureInfo);

        wrapper.appendChild(checkbox);
        wrapper.appendChild(document.createTextNode(labelText));

        elements.exposureClassContainer.appendChild(wrapper);
    });
}

function updateGoverningExposureInfo() {
    const selected = getSelectedExposureClasses();
    const governingCode = getGoverningExposureClass(selected);
    
    if (governingCode) {
        elements.govClassCode.textContent = governingCode;
        elements.govClassDesc.textContent = i18n.t(`exp.${governingCode}.d`) || '';
        elements.governingExposureInfo.classList.remove('hidden');
    } else {
        elements.governingExposureInfo.classList.add('hidden');
    }
}

function getSelectedExposureClasses() {
    return Array.from(elements.exposureClassContainer.querySelectorAll('input[name="exposureClass"]:checked')).map(i => i.value);
}

function updateOptionalSections() {
    elements.airEntrainingContainer.classList.toggle('hidden', !elements.useAirEntraining.checked);
    elements.flyAshContainer.classList.toggle('hidden',        !elements.useFlyAsh.checked);
    elements.silicaFumeContainer.classList.toggle('hidden',    !elements.useSilicaFume.checked);
    elements.waterproofContainer.classList.toggle('hidden',    !elements.useWaterproofing.checked);
    elements.moistureContainer.classList.toggle('hidden',      !elements.useMoisture.checked);
}

function updateHints() {
    // Strength class hint
    const sc = getStrengthClass(elements.strengthClass.value);
    if (elements.strengthHint) {
        elements.strengthHint.textContent = sc
            ? i18n.t('index.strength.hint', { fck: sc.f_ck_cube })
            : i18n.t('index.strength.hint.default');
    }

    // Sieve line hint
    const siebKey = elements.siebline.value;
    const sieb = SIEBLINIES[siebKey];
    if (elements.sieblinieHint) {
        const hintKey = SIEBLINE_HINT_KEYS[siebKey.replace(/[A-Z/]/g, '')];
        elements.sieblinieHint.textContent = sieb
            ? (hintKey ? i18n.t(hintKey) : '')
            : i18n.t('index.siebline.hint.not.found');
    }

    // Consistency class hint
    const cons = elements.consistencyClass.value;
    const admForHint = elements.admixtureType.value;
    const consHintEl = document.getElementById('consistencyHint');
    if (consHintEl) {
        const consHint = i18n.t(CONSISTENCY_HINT_KEYS[cons] || cons);
        if (['F4', 'F5', 'F6'].includes(cons) && admForHint !== 'FM') {
            consHintEl.textContent = i18n.t('index.consistency_fm_required', { cls: cons });
            consHintEl.style.color = '#c0392b';
        } else if (['F4', 'F5', 'F6'].includes(cons) && admForHint === 'FM') {
            consHintEl.textContent = `${consHint} ${i18n.t('index.consistency.hint.fm.active')}`;
            consHintEl.style.color = '#27ae60';
        } else {
            consHintEl.textContent = consHint;
            consHintEl.style.color = '';
        }
    }

    // Admixture hint
    const adm = elements.admixtureType.value;
    if (elements.admixtureHint) {
        if (adm === 'none') {
            elements.admixtureHint.textContent = i18n.t('index.admixture.none');
        } else if (adm === 'BV') {
            elements.admixtureHint.textContent = i18n.t('index.admixture.bv.hint', { saving: getRecommendedWaterSaving('BV'), dosage: getAdmixtureDosage('BV') });
        } else if (adm === 'FM') {
            elements.admixtureHint.textContent = i18n.t('index.admixture.fm.hint', { saving: getRecommendedWaterSaving('FM'), dosage: getAdmixtureDosage('FM') });
        }
    }

    // Use case hint
    if (elements.useCaseHint) {
        elements.useCaseHint.textContent = i18n.t('index.usecase.hint');
    }
}

function applyUseCaseDefaults() {
    const useCaseValue = elements.useCase.value;
    const useCaseData = USE_CASES[useCaseValue] || null;

    if (!useCaseData) return;

    elements.strengthClass.value = useCaseData.strength;

    const targetExposure = useCaseData.exposure;
    const exposures = elements.exposureClassContainer.querySelectorAll('input[name="exposureClass"]');
    exposures.forEach(el => { el.checked = el.value === targetExposure; });

    elements.siebline.value = useCaseData.siebline || 'B32';
    elements.consistencyClass.value = useCaseData.consistency || 'F3';
    elements.aggregateType.value = useCaseData.aggregateType || 'Granit';
    elements.admixtureType.value = useCaseData.admixtureType || 'none';
    elements.cementType.value = useCaseData.cementType || 'CEM I 42.5 N';
    elements.vorhaltemas.value = useCaseData.vorhaltemas ?? 3;

    elements.useAirEntraining.checked = false;
    elements.useFlyAsh.checked = false;
    elements.useSilicaFume.checked = false;
    elements.useWaterproofing.checked = false;
    elements.useMoisture.checked = false;

    updateOptionalSections();
    updateHints();
    updateGoverningExposureInfo();
}

function collectFormValues() {
    const volume = Math.max(0.001, parseFloat(elements.volume.value.replace(',', '.')) || 1);
    const strengthClass = elements.strengthClass.value || 'C20/25';
    const exposureClasses = getSelectedExposureClasses();
    const exposureClass = exposureClasses.length > 0 ? getGoverningExposureClass(exposureClasses) : null;

    const cementTypeName = elements.cementType.value || 'CEM I 42.5 N';
    const cementMeta = getCementType(cementTypeName);
    const faMaxPct = cementMeta ? Math.round(cementMeta.faMaxFactor * 100) : 33;

    return {
        useCase: elements.useCase.value || 'standard',
        volume,
        strengthClass,
        exposureClass: exposureClass || exposureClasses[0] || 'XC1',
        siebline: elements.siebline.value || 'B32',
        consistencyClass: elements.consistencyClass.value || 'F3',
        aggregateType: elements.aggregateType.value || 'Granit',
        cementType: cementTypeName,
        vorhaltemas: Math.max(3, Math.min(12, parseFloat(elements.vorhaltemas.value) || 3)),
        admixtureType: elements.admixtureType.value || 'none',
        useAirEntraining: elements.useAirEntraining.checked,
        airEntrainingPercent: Math.max(0, parseFloat(elements.airEntrainingPercent.value) || 0),
        useFlyAsh: elements.useFlyAsh.checked,
        flyAshPercent: Math.max(0, Math.min(faMaxPct, parseFloat(elements.flyAshPercent.value) || 0)),
        useSilicaFume: elements.useSilicaFume.checked,
        silicaFumePercent: Math.max(0, Math.min(11, parseFloat(elements.silicaFumePercent.value) || 0)),
        useWaterproofing: elements.useWaterproofing.checked,
        waterproofPercent: Math.max(0, Math.min(5, parseFloat(elements.waterproofPercent.value) || 0)),
        useMoisture: elements.useMoisture.checked,
        moisture0_2:  (v => Number.isNaN(v) ? 5 : v)(parseFloat(elements.moisture0_2.value)),
        moisture2_8:  (v => Number.isNaN(v) ? 3 : v)(parseFloat(elements.moisture2_8.value)),
        moisture8plus: (v => Number.isNaN(v) ? 2 : v)(parseFloat(elements.moisture8plus.value))
    };
}

function calculateRecipe() {
    clearError();

    if (getSelectedExposureClasses().length === 0) {
        return setError(i18n.t('err.no.exp'));
    }

    const values = collectFormValues();
    appState = { ...appState, ...values };

    // ── Step 1: Grenzwerte aus allen Expositionsklassen (DIN 1045-2: strengste Werte) ─
    const selectedExposureClasses = getSelectedExposureClasses();
    const strictLimits = getStrictestLimits(selectedExposureClasses);
    const maxWz_exposure = strictLimits.maxWz < Infinity ? strictLimits.maxWz : 0.75;
    const minZ_eff = strictLimits.minZ;

    // ── Step 2: Wassergehalt aus Sieblinie / Konsistenz ───────────────────────
    // F4–F6 require FM (Fließmittel) per B20 – fluidity is achieved via admixture
    const highConsistency = ['F4', 'F5', 'F6'].includes(appState.consistencyClass);
    if (highConsistency && appState.admixtureType !== 'FM') {
        return setError(i18n.t('err.missing.fm', { cls: appState.consistencyClass }));
    }

    const baseWater = calculateWaterDemand(appState.siebline, appState.consistencyClass);
    if (baseWater === null) {
        return setError(i18n.t('err.invalid'));
    }

    let waterTarget = baseWater;
    const isCrushed = /splitt/i.test(appState.aggregateType) || appState.aggregateType === 'Basalt' || appState.aggregateType === 'Dichter Kalkstein';
    waterTarget = adjustForAggregateType(waterTarget, isCrushed);

    if (appState.useAirEntraining && appState.airEntrainingPercent > 0) {
        waterTarget = adjustForAirEntraining(waterTarget, appState.airEntrainingPercent);
    }

    if (appState.admixtureType && appState.admixtureType !== 'none') {
        waterTarget = applyAdmixtureWaterReduction(waterTarget, appState.admixtureType);
    }

    waterTarget = Math.max(120, Math.min(waterTarget, 260));

    // ── Step 3: Zielwert der mittleren Betondruckfestigkeit ───────────────────
    const strengthMeta = getStrengthClass(appState.strengthClass);
    const f_ck_cube = strengthMeta ? strengthMeta.f_ck_cube : 25;
    const f_cm_target = calculateTargetStrengthWithMargin(f_ck_cube, 0, appState.vorhaltemas);

    // ── Step 4: Maximaler w/z-Wert ────────────────────────────────────────────
    const cementMeta = getCementType(appState.cementType);
    const walzkurveKey = cementMeta ? cementMeta.walzkurveKey : '42.5';
    const cementDensity = cementMeta ? cementMeta.density : 3.0;

    let wz_walz = calculateWzFromTargetStrength(f_cm_target, walzkurveKey);
    let maxWz = maxWz_exposure;
    let wzSource = 'exposure'; // i18n key resolved at display time

    if (wz_walz !== null) {
        if (wz_walz < maxWz_exposure) {
            // Walzkurven w/z is tighter — strength governs
            maxWz = wz_walz;
            wzSource = 'walz'; // i18n key resolved at display time
        } else {
            // Exposure governs — apply betontechnologische Abminderung –0.02
            maxWz = maxWz_exposure - 0.02;
        }
    }
    maxWz = Math.max(0.35, Math.min(maxWz, 0.95));

    // ── Step 5: Zementgehalt ──────────────────────────────────────────────────
    // SCMs lower required cement via the equivalent w/z concept (B20 Abschnitt 7.2):
    //   (w/z)_eq = w / (z + k_FA·FA + k_SF·SF)  →  z = w / (maxWz · scmFactor)
    // where scmFactor = 1 + k_FA·α_FA + k_SF·α_SF
    const k_FA = 0.4; // Anrechenbarkeit Flugasche
    const k_SF = 1.0; // Anrechenbarkeit Silikastaub
    const alpha_FA = appState.useFlyAsh    ? appState.flyAshPercent    / 100 : 0;
    const alpha_SF = appState.useSilicaFume ? appState.silicaFumePercent / 100 : 0;
    const scmFactor = 1 + k_FA * alpha_FA + k_SF * alpha_SF;

    let cementAmount = waterTarget / (maxWz * scmFactor);

    // Enforce minimum cement from strictest of all selected exposure classes
    if (cementAmount < minZ_eff) {
        cementAmount = minZ_eff;
    }
    cementAmount = Math.round(cementAmount);

    if (!cementAmount || cementAmount <= 0) {
        return setError(i18n.t('err.cement'));
    }

    // Supplementary materials (fractions of the now-reduced cement content)
    const flyAshMass       = appState.useFlyAsh       ? cementAmount * alpha_FA : 0;
    const silicaFumeMass   = appState.useSilicaFume   ? cementAmount * alpha_SF : 0;
    const waterProofingMass = appState.useWaterproofing ? (cementAmount * appState.waterproofPercent) / 100 : 0;

    // Equivalent w/z (should equal maxWz exactly; shown in calculation steps)
    let equivalentWz = null;
    if (flyAshMass > 0 || silicaFumeMass > 0) {
        equivalentWz = calculateEquivalentWzWithBoth(waterTarget, cementAmount, flyAshMass, silicaFumeMass);
    }

    // ── Step 6: Stoffraumrechnung – Gesteinskörnung ───────────────────────────
    const airVolumeDm3 = 20 + (appState.useAirEntraining ? appState.airEntrainingPercent * 10 : 0);
    const flyAshDensity = 2.3; // kg/dm³ (Tafel 6, middle of range 2.2–2.4)
    const silicaDensity = 2.2; // kg/dm³ (Tafel 6)

    // Stoffraumrechnung: 1000 = z/ρz + w/ρw + f/ρf + s/ρs + vWU + g/ρg + LP
    const vz = cementAmount / cementDensity;
    const vw = waterTarget / 1.0;
    const vf = flyAshMass / flyAshDensity;
    const vs = silicaFumeMass / silicaDensity;
    const vWU = waterProofingMass / 2.0; // WU-Additiv density ≈ 2.0 kg/dm³
    const vLP = airVolumeDm3;
    const rhoG = getAverageDensity(appState.aggregateType) || 2.65;
    const vg = 1000 - vz - vw - vf - vs - vWU - vLP;
    const aggregateMass = Math.round(vg * rhoG);

    // ── Step 7: Korngruppen und Zugabewasser ──────────────────────────────────
    const moistures = appState.useMoisture
        ? [appState.moisture0_2, appState.moisture2_8, appState.moisture8plus]
        : [0, 0, 0];
    const korngruppen = distributeAggregateBySiebline(aggregateMass, appState.siebline, moistures);
    const zugabewasser = korngruppen
        ? calculateZugabewasser(waterTarget, korngruppen)
        : Math.round(waterTarget);

    // ── Step 8: Mehlkorngehalt prüfen ────────────────────────────────────────
    const finesFromAggregate = aggregateMass * getFinesFraction(appState.siebline);
    const mehlkorngehalt = Math.round(cementAmount + flyAshMass + silicaFumeMass + finesFromAggregate);

    const recipe = {
        targetStrength: f_cm_target,
        wzLimit: maxWz,
        wzExposure: maxWz_exposure,
        minZeff: minZ_eff,
        strictLimits,
        wzWalz: wz_walz ? Math.round(wz_walz * 100) / 100 : null,
        wzSource,
        fCmTarget: f_cm_target,
        vorhaltemas: appState.vorhaltemas,
        sigma: 0,
        cementDensity,
        airVolumeDm3,
        mehlkorngehalt,
        materials: {
            cement: cementAmount,
            flyAsh: flyAshMass,
            silicaFume: silicaFumeMass,
            waterproofing: waterProofingMass,
            water: waterTarget,
            zugabewasser,
            aggregate: aggregateMass,
            admixture: appState.admixtureType === 'none' ? 0 : getAdmixtureDosage(appState.admixtureType) || 0,
            admixtureUnit: 'Liter'
        },
        korngruppen,
        airEntraining: appState.useAirEntraining ? appState.airEntrainingPercent : 0,
        equivalentWz,
        stoffraum: { vz: Math.round(vz), vw: Math.round(vw), vf: Math.round(vf), vs: Math.round(vs), vWU: Math.round(vWU), vLP, vg: Math.round(vg) }
    };

    appState.plausibilityWarnings = evaluatePlausibility(appState, recipe);

    // Fill effect list
    const effectNotes = [];
    if (appState.useAirEntraining) {
        effectNotes.push(i18n.t('effect.lp', { airPct: appState.airEntrainingPercent, loss: Math.round(appState.airEntrainingPercent * 3.5) }));
    }
    if (appState.useFlyAsh) {
        effectNotes.push(i18n.t('effect.flyash', { pct: appState.flyAshPercent }));
    }
    if (appState.useSilicaFume) {
        effectNotes.push(i18n.t('effect.silica', { pct: appState.silicaFumePercent }));
    }
    if (appState.useWaterproofing) {
        effectNotes.push(i18n.t('effect.waterproof', { pct: appState.waterproofPercent }));
    }

    if (elements.effectsList) {
        elements.effectsList.innerHTML = effectNotes.join('<br>');
        elements.additivesSummary.classList.toggle('hidden', effectNotes.length === 0);
    }

    displayRecipe(recipe);
}

function displayRecipe(recipe) {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();

    elements.resultsSection.classList.remove('hidden');


    // ── Plausibility warnings ─────────────────────────────────────────────────
    const existingWarnings = elements.resultsSection.querySelector('.plausibility-warning');
    if (existingWarnings) existingWarnings.remove();

    if (appState.plausibilityWarnings && appState.plausibilityWarnings.length > 0) {
        const warningsNode = document.createElement('div');
        warningsNode.className = 'plausibility-warning';
        warningsNode.innerHTML = `⚠️ ${appState.plausibilityWarnings.join('<br>⚠️ ')}`;
        const calcDetails = elements.calcDetails;
        calcDetails.parentNode.insertBefore(warningsNode, calcDetails);
    }

    // ── Collapsible calculation steps (B20 Tafel 9) ──────────────────────────
    const wzWalzStr = recipe.wzWalz ? `w/z_Walz = ${recipe.wzWalz.toFixed(2)} (–0.02 Abminderung)` : '–';
    const eqWzStr = recipe.equivalentWz ? ` | (w/z)_eq = ${recipe.equivalentWz.toFixed(2)}` : '';
    const fck = getStrengthClass(appState.strengthClass)?.f_ck_cube ?? '–';
    const sourceLabel = recipe.wzSource === 'walz'
        ? i18n.t('step.source.walz')
        : i18n.t('step.source.exposure');
    const steps = [
        ['1', i18n.t('step.1.label'), i18n.t('step.1.value', { wz: recipe.wzExposure.toFixed(2), minZ: recipe.minZeff })],
        ['2', i18n.t('step.2.label'), i18n.t('step.2.value', { water: formatNumber(recipe.materials.water, 0) })],
        ['3', i18n.t('step.3.label'), i18n.t('step.3.value', { fck, fcm: formatNumber(recipe.fCmTarget, 1), sigma: recipe.sigma, vorhaltemas: recipe.vorhaltemas })],
        ['4', i18n.t('step.4.label'), i18n.t('step.4.value', { wzWalz: wzWalzStr, wzExp: recipe.wzExposure.toFixed(2), source: sourceLabel, wzLimit: recipe.wzLimit.toFixed(2) })],
        ['5', i18n.t('step.5.label'), i18n.t('step.5.value', { water: formatNumber(recipe.materials.water, 0), wz: recipe.wzLimit.toFixed(2), cement: formatNumber(recipe.materials.cement, 0), eqWz: eqWzStr })],
        ['6', i18n.t('step.6.label'), i18n.t('step.6.value', { vz: recipe.stoffraum.vz, vw: recipe.stoffraum.vw, vf: recipe.stoffraum.vf + recipe.stoffraum.vs, lp: recipe.stoffraum.vLP, vg: recipe.stoffraum.vg })],
        ['7', i18n.t('step.7.label'), i18n.t('step.7.value', { water: formatNumber(recipe.materials.water, 0), zugabe: formatNumber(recipe.materials.zugabewasser, 0) })],
        ['8', i18n.t('step.8.label'), i18n.t('step.8.value', { fines: formatNumber(recipe.mehlkorngehalt, 0) })]
    ];

    elements.calcStepsBody.innerHTML = steps.map(([n, label, value]) =>
        `<tr><td class="step-num">${n}</td><td class="step-label">${label}</td><td class="step-value">${value}</td></tr>`
    ).join('');

    // ── Ingredients header ────────────────────────────────────────────────────
    const vol = appState.volume;
    elements.ingredientsHeader.textContent = i18n.t('index.results.detail', { vol, klasse: appState.strengthClass, fcm: formatNumber(recipe.fCmTarget, 1) });
    elements.volumeColHeader.textContent = vol !== 1 ? i18n.t('index.vol.prefix') + ` ${vol} m³` : i18n.t('index.vol.default');

    // ── Main ingredients table ────────────────────────────────────────────────
    const tableRows = [];

    const addRow = (name, perM3, unit, totalQty, totalUnit, note) => {
        tableRows.push(`<tr>
            <td>${name}</td>
            <td>${formatNumber(perM3, 1)} ${unit}/m³</td>
            <td>${formatQuantity(totalQty, totalUnit)}</td>
            <td>${note}</td>
        </tr>`);
    };

    addRow(appState.cementType, recipe.materials.cement, 'kg', recipe.materials.cement * vol, 'kg',
        i18n.t('recipe.cement.note'));

    if (recipe.materials.flyAsh > 0) {
        addRow(i18n.t('mixdesign.flyash'), recipe.materials.flyAsh, 'kg', recipe.materials.flyAsh * vol, 'kg',
            i18n.t('recipe.flyash.note'));
    }
    if (recipe.materials.silicaFume > 0) {
        addRow(i18n.t('mixdesign.silica'), recipe.materials.silicaFume, 'kg', recipe.materials.silicaFume * vol, 'kg',
            i18n.t('recipe.silica.note'));
    }

    // Water rows
    const eigenfeuchte = Math.round(recipe.materials.water - recipe.materials.zugabewasser);
    const hasZugabe = eigenfeuchte > 0;
    if (hasZugabe) {
        tableRows.push(`<tr>
            <td>${i18n.t('recipe.eigenfeuchte.label')}</td>
            <td>${formatNumber(eigenfeuchte, 0)} l/m³</td>
            <td>${formatQuantity(eigenfeuchte * vol, 'l')}</td>
            <td>${i18n.t('recipe.eigenfeuchte.note')}</td>
        </tr>`);
        tableRows.push(`<tr>
            <td><strong>${i18n.t('recipe.zugabewasser.label')}</strong></td>
            <td><strong>${formatNumber(recipe.materials.zugabewasser, 0)} l/m³</strong></td>
            <td><strong>${formatQuantity(recipe.materials.zugabewasser * vol, 'l')}</strong></td>
            <td><strong>${i18n.t('recipe.zugabewasser.note')}</strong></td>
        </tr>`);
    } else {
        tableRows.push(`<tr>
            <td>${i18n.t('recipe.water.label')}</td>
            <td>${formatNumber(recipe.materials.water, 0)} l/m³</td>
            <td>${formatQuantity(recipe.materials.water * vol, 'l')}</td>
            <td>${i18n.t('recipe.water.note')}</td>
        </tr>`);
    }

    if (appState.admixtureType !== 'none') {
        const saving = getRecommendedWaterSaving(appState.admixtureType) ?? 0;
        addRow(
            i18n.t(appState.admixtureType === 'BV' ? 'admixture.BV' : 'admixture.FM'),
            recipe.materials.admixture, 'l',
            recipe.materials.admixture * vol, 'l',
            i18n.t('recipe.bv.note', { saving })
        );
    }

    if (appState.useAirEntraining) {
        const lpDosage = getAdmixtureDosage('LP', appState.airEntrainingPercent);
        addRow(
            i18n.t('mixdesign.air.entry'),
            lpDosage, 'l',
            lpDosage * vol, 'l',
            i18n.t('recipe.lp.note', { airPct: recipe.airEntraining, loss: Math.round(recipe.airEntraining * 3.5) })
        );
    }

    // Aggregate: total row (detail breakdown follows in Korngruppen table)
    addRow(`${i18n.t('mixdesign.aggregate')} (${appState.aggregateType})`,
        recipe.materials.aggregate, 'kg',
        recipe.materials.aggregate * vol, 'kg',
        i18n.t('recipe.aggregate.note'));


    if (recipe.materials.waterproofing > 0) {
        addRow(i18n.t('mixdesign.waterproofing'), recipe.materials.waterproofing, 'kg', recipe.materials.waterproofing * vol, 'kg',
            i18n.t('recipe.waterproof.note'));
    }

    elements.recipeBody.innerHTML = tableRows.join('');

    // ── Korngruppen table ─────────────────────────────────────────────────────
    if (recipe.korngruppen && recipe.korngruppen.length > 0) {
        elements.kornGruppenSection.classList.remove('hidden');
        let kgRows = '';
        let totalDry = 0, totalMoist = 0;
    recipe.korngruppen.forEach(kg => {
        totalDry += kg.massDry;
        totalMoist += kg.massMoist;
        kgRows += `<tr>
            <td>${kg.range} mm</td>
            <td>${kg.pct}</td>
            <td>${formatQuantity(kg.massDry * vol, 'kg')}</td>
            <td>${formatNumber(kg.moisturePct, 1)}</td>
            <td>${formatQuantity(kg.massMoist * vol, 'kg')}</td>
        </tr>`;
    });
    kgRows += `<tr class="total-row">
        <td><strong>${i18n.t('recipe.sum.label')}</strong></td>
        <td>100</td>
        <td><strong>${formatQuantity(totalDry * vol, 'kg')}</strong></td>
        <td>–</td>
        <td><strong>${formatQuantity(totalMoist * vol, 'kg')}</strong></td>
    </tr>`;
        elements.kornGruppenBody.innerHTML = kgRows;

        const moistureTotal = (totalMoist - totalDry) * vol;
        elements.zugabewasserInfo.innerHTML =
            `<strong>${i18n.t('recipe.water.label')}:</strong> ${formatQuantity(recipe.materials.water * vol, 'l')} &nbsp;–&nbsp; ` +
            `<strong>${i18n.t('recipe.eigenfeuchte.label')}:</strong> ${formatQuantity(moistureTotal, 'l')} &nbsp;=&nbsp; ` +
            `<strong>${i18n.t('recipe.zugabewasser.label')}:</strong> ${formatQuantity(recipe.materials.zugabewasser * vol, 'l')}`;
    } else {
        elements.kornGruppenSection.classList.add('hidden');
    }

    // ── Mixing instructions ───────────────────────────────────────────────────
    const totalCement = recipe.materials.cement * vol;
    const totalAgg = recipe.materials.aggregate * vol;
    const totalFA = recipe.materials.flyAsh * vol;
    const totalSF = recipe.materials.silicaFume * vol;
    const totalWU = recipe.materials.waterproofing * vol;
    const totalAdm = recipe.materials.admixture * vol;
    const totalWater = recipe.materials.zugabewasser * vol;

    const lpDosage = appState.useAirEntraining ? getAdmixtureDosage('LP', appState.airEntrainingPercent) * vol : 0;

    const baseInstructions = [
        i18n.t('step.mixer.1.dry', { cement: formatQuantity(totalCement, 'kg'), cementType: appState.cementType, aggregate: formatQuantity(totalAgg, 'kg') }),
        totalFA > 0 ? i18n.t('step.mixer.2.flyash', { flyash: formatQuantity(totalFA, 'kg') }) : '',
        totalSF > 0 ? i18n.t('step.mixer.3.silica', { silica: formatQuantity(totalSF, 'kg') }) : '',
        totalWU > 0 ? i18n.t('step.mixer.4.wu', { wu: formatQuantity(totalWU, 'kg') }) : '',
        i18n.t('step.mixer.5.water', { water: formatQuantity(totalWater, 'l') }),
        totalAdm > 0 ? i18n.t('step.mixer.6.admixture', { admixture: formatQuantity(totalAdm, 'l'), label: i18n.t(appState.admixtureType === 'BV' ? 'admixture.BV' : 'admixture.FM') }) : '',
        lpDosage > 0 ? i18n.t('step.mixer.7.lp', { lp: formatQuantity(lpDosage, 'l'), airPct: recipe.airEntraining }) : '',
        i18n.t('step.mixer.8.mix', { consistency: appState.consistencyClass }),
        i18n.t('step.mixer.9.handle')
    ].filter(ii => ii);

    elements.instructionList.innerHTML = baseInstructions.map(inst => `<li>${inst}</li>`).join('');

    // ── Fine-tune button ──────────────────────────────────────────────────────
    // Store recipe in sessionStorage so fine-tune.html gets it regardless of
    // how the dev server handles query strings (some strip them on clean URLs).
    try {
        // Reverse any plasticizer water reduction so fine-tune starts from the
        // pre-admixture base water and re-applies only the additives it knows about.
        const plasticizer = appState.admixtureType;
        const savingPct   = (plasticizer === 'BV' || plasticizer === 'FM')
            ? getRecommendedWaterSaving(plasticizer) : 0;
        const wBase = savingPct > 0
            ? Math.round(recipe.materials.water * 100 / (100 - savingPct))
            : Math.round(recipe.materials.water);

        sessionStorage.setItem('creteLab_finetune', JSON.stringify({
            v:         vol,
            z:         Math.round(recipe.materials.cement),
            w:         wBase,
            g:         Math.round(recipe.materials.aggregate),
            wz:        recipe.wzLimit,
            klasse:    appState.strengthClass,
            zement:    appState.cementType,
            useFlyAsh: appState.useFlyAsh        || false,
            useSilica: appState.useSilicaFume    || false,
            useBV:     plasticizer === 'BV',
            useFM:     plasticizer === 'FM',
            useLP:     appState.useAirEntraining || false,
        }));
    } catch (_) { /* sessionStorage blocked */ }

    // Two follow-up paths shown as uniform hint paragraphs below the recipe:
    //   1. Fine-tune the current B 20 recipe with additives.
    //   2. Switch to the UHPC scaler for extreme strengths.
    // Idempotent against repeated displayRecipe() calls — the IDs are reused.
    ensureFollowupHint('fineTuneHint', '20px', i18n.t('index.fine.tune.hint'));
    ensureFollowupHint('uhpcHint', '8px', i18n.t('index.uhpc.hint'));

    // Old button-styled fine-tune link from a previous render — drop it.
    const legacy = document.getElementById('fineTuneBtn');
    if (legacy) legacy.remove();
}

function ensureFollowupHint(id, marginTop, html) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('p');
        el.id = id;
        el.className = 'followup-hint';
        elements.resultsSection.appendChild(el);
    }
    el.style.marginTop = marginTop;
    el.innerHTML = html;
}

function initialize() {
    buildSelectOptions(elements.useCase, Object.entries(USE_CASES).map(([key, data]) => ({ value: key, label: '' })), 'standard',
        Object.fromEntries(Object.entries(USE_CASES).map(([k, v]) => [k, v.labelKey])));
    buildSelectOptions(elements.strengthClass, getAvailableClasses().map(value => ({ value, label: '' })), 'C20/25', STRENGTH_CLASS_KEYS);
    buildExposureCheckboxes();

    const sieblineOptions = Object.keys(GRAIN_GROUPS_BY_SIEBLINE).sort();
    buildSelectOptions(elements.siebline, sieblineOptions.map(v => ({ value: v, label: '' })), 'B32', SIEBLINE_KEYS);

    buildSelectOptions(elements.consistencyClass, getAvailableConsistencyClasses().map(value => ({ value, label: '' })), 'F3', CONSISTENCY_KEYS);
    buildSelectOptions(elements.aggregateType, getAvailableAggregates().map(value => ({ value, label: '' })), 'Kiessand (Quarz)', AGGREGATE_KEYS);

    buildSelectOptions(elements.cementType,
        getAvailableCementTypes().map(v => ({ value: v, label: '' })),
        'CEM I 42.5 N', CEMENT_TYPE_KEYS);

    buildSelectOptions(elements.admixtureType, [
        { value: 'none', label: '' },
        { value: 'BV', label: '' },
        { value: 'FM', label: '' }
    ], 'none', { none: 'admixture.none', BV: 'admixture.BV', FM: 'admixture.FM' });

    applyUseCaseDefaults();
    updateOptionalSections();

    elements.useCase.addEventListener('change', () => { applyUseCaseDefaults(); calculateRecipe(); });
    elements.strengthClass.addEventListener('change', updateHints);
    elements.siebline.addEventListener('change', updateHints);
    elements.consistencyClass.addEventListener('change', updateHints);
    elements.admixtureType.addEventListener('change', updateHints);
    elements.useAirEntraining.addEventListener('change', updateOptionalSections);
    elements.airEntrainingPercent.addEventListener('input', calculateRecipe);
    elements.useFlyAsh.addEventListener('change', updateOptionalSections);
    elements.useSilicaFume.addEventListener('change', updateOptionalSections);
    elements.useWaterproofing.addEventListener('change', updateOptionalSections);
    elements.useMoisture.addEventListener('change', () => { updateOptionalSections(); calculateRecipe(); });

    elements.volume.addEventListener('input', calculateRecipe);

    elements.calculateBtn.addEventListener('click', (event) => {
        event.preventDefault();
        calculateRecipe();
    });

    const recipeForm = document.getElementById('recipeForm');
    if (recipeForm) recipeForm.addEventListener('submit', (event) => event.preventDefault());

    updateGoverningExposureInfo();
    calculateRecipe();

    // Re-render on language change
    document.addEventListener('languagechange', () => {
        initialize();
        if (appState.strengthClass) calculateRecipe();
    });
}

window.addEventListener('DOMContentLoaded', initialize);

// Export functions for test harnesses
export { initialize, calculateRecipe, collectFormValues, displayRecipe, elements, evaluatePlausibility, applyUseCaseDefaults };
