import { getAvailableClasses, getStrengthClass,
         calculateTargetStrengthWithMargin, calculateWzFromTargetStrength,
         getAvailableCementTypes, getCementType } from './lib/strength.js';
import { getAvailableExposureClasses, getGoverningExposureClass, getMaxWz, getExposureClass, satisfiesExposureRequirements } from './lib/exposure.js';
import { getAvailableConsistencyClasses, calculateWaterDemand, adjustForAggregateType, SIEBLINIES } from './lib/consistency.js';
import { getAvailableAggregates, getAverageDensity } from './lib/densities.js';
import { applyAdmixtureWaterReduction, adjustForAirEntraining, calculateEquivalentWzWithBoth, getAdmixtureDosage, getRecommendedWaterSaving } from './lib/additives.js';
import { calculateFinesContent, checkFinesLimits, calculatePasteVolume, checkPasteRequirements, checkCemIFlyAshSilicaFume } from './lib/fines-content.js';
import { getFinesFraction, distributeAggregateBySiebline, calculateZugabewasser, GRAIN_GROUPS_BY_SIEBLINE } from './lib/aggregate-gradation.js';

const USE_CASES = {
    cheap:       { label: 'Einfach – Fundamente, Verfüllung (C20/25)', strength: 'C20/25', exposure: 'XC1', siebline: 'B32', consistency: 'F3', aggregateType: 'Granit',      admixtureType: 'none', cementType: 'CEM I 42.5 N', vorhaltemas: 3 },
    standard:    { label: 'Standard – Wände, Decken, Treppen (C25/30)', strength: 'C25/30', exposure: 'XC2', siebline: 'B32', consistency: 'F3', aggregateType: 'Granit',      admixtureType: 'none', cementType: 'CEM I 42.5 N', vorhaltemas: 3 },
    strong:      { label: 'Stark – Außenbereiche, Stützen (C30/37)',    strength: 'C30/37', exposure: 'XC3', siebline: 'B16', consistency: 'F3', aggregateType: 'Betonsplitt', admixtureType: 'BV',   cementType: 'CEM I 42.5 N', vorhaltemas: 5 },
    ultraStrong: { label: 'Sehr stark – Industrieböden, XD/XF (C40/50)', strength: 'C40/50', exposure: 'XC4', siebline: 'B16', consistency: 'F3', aggregateType: 'Betonsplitt', admixtureType: 'FM',   cementType: 'CEM I 52.5 R', vorhaltemas: 5 }
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
    ingredientsHeader: document.getElementById('ingredientsHeader'),
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
    aggregateType: 'Granit',
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
    return Number(value).toLocaleString('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function setError(message) {
    clearError();
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    elements.resultsSection.parentNode.insertBefore(error, elements.resultsSection);
    elements.resultsSection.style.display = 'none';
}

function clearError() {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
}

function evaluatePlausibility(state, recipe) {
    const warnings = [];

    const exposureData = getExposureClass(state.exposureClass);
    if (exposureData) {
        if (!satisfiesExposureRequirements(state.strengthClass, state.exposureClass)) {
            warnings.push(`Stärke ${state.strengthClass} erfüllt möglicherweise nicht Mindestfestigkeiten für Expositionsklasse ${state.exposureClass}.`);
        }

        if (recipe.materials.cement < exposureData.min_z) {
            warnings.push(`Zementgehalt ${formatNumber(recipe.materials.cement,1)} kg/m³ ist unter Mindestwert ${exposureData.min_z} kg/m³ für ${state.exposureClass}.`);
        }

        const wzc = recipe.materials.water / recipe.materials.cement;
        if (exposureData.max_wz !== null && wzc > exposureData.max_wz + 0.005) {
            warnings.push(`W/z=${wzc.toFixed(2)} ist über dem Limit ${exposureData.max_wz.toFixed(2)} für ${state.exposureClass}.`);
        }
    }

    // Paste volume check (Zementleimgehalt)
    const paste = calculatePasteVolume(recipe.materials.cement, recipe.materials.flyAsh, recipe.materials.silicaFume);
    if (paste && !checkPasteRequirements(paste, state.exposureClass).meetsRequirement) {
        warnings.push(`Zementleimgehalt ${formatNumber(paste.pasteVolume)} kg/m³ unterschreitet Mindestwert für Expositionsklasse ${state.exposureClass}.`);
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
            warnings.push(`Mehlkorngehalt ${formatNumber(fines.finesContent0125)} kg/m³ überschreitet Maximum ${finesCheck.maxAllowed} kg/m³ für Expositionsklasse ${state.exposureClass}.`);
        }
    }

    // CEM I specific check for combined fly ash and silica fume
    if (recipe.materials.flyAsh > 0 && recipe.materials.silicaFume > 0) {
        const cemICheck = checkCemIFlyAshSilicaFume(recipe.materials.cement, recipe.materials.flyAsh, recipe.materials.silicaFume);
        if (!cemICheck.meetsLimit) {
            warnings.push(`CEM I Limit: Flugasche/Zement ${cemICheck.fZRatio.toFixed(3)} überschreitet Maximum ${cemICheck.maxFLimit.toFixed(3)} für Silikastaub ${cemICheck.sZRatio.toFixed(3)}.`);
        }
    }

    return warnings;
}

function buildSelectOptions(select, options, selectedValue) {
    select.innerHTML = '';
    options.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (value === selectedValue) option.selected = true;
        select.appendChild(option);
    });
}

function buildExposureCheckboxes() {
    const values = getAvailableExposureClasses();
    elements.exposureClassContainer.innerHTML = '';

    values.forEach(exposureCode => {
        const exposureData = getExposureClass(exposureCode);
        const labelText = exposureData ? `${exposureCode} - ${exposureData.name}` : exposureCode;

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
        const data = getExposureClass(governingCode);
        elements.govClassCode.textContent = governingCode;
        elements.govClassDesc.textContent = data ? data.description : '';
        elements.governingExposureInfo.style.display = 'block';
    } else {
        elements.governingExposureInfo.style.display = 'none';
    }
}

function getSelectedExposureClasses() {
    return Array.from(elements.exposureClassContainer.querySelectorAll('input[name="exposureClass"]:checked')).map(i => i.value);
}

function updateOptionalSections() {
    elements.airEntrainingContainer.style.display = elements.useAirEntraining.checked ? 'block' : 'none';
    elements.flyAshContainer.style.display = elements.useFlyAsh.checked ? 'block' : 'none';
    elements.silicaFumeContainer.style.display = elements.useSilicaFume.checked ? 'block' : 'none';
    elements.waterproofContainer.style.display = elements.useWaterproofing.checked ? 'block' : 'none';
    elements.moistureContainer.style.display = elements.useMoisture.checked ? 'block' : 'none';
}

function updateHints() {
    // Strength class hint
    const sc = getStrengthClass(elements.strengthClass.value);
    if (elements.strengthHint) {
        elements.strengthHint.textContent = sc
            ? `f_ck,Zyl = ${sc.f_ck_cyl} N/mm² | f_ck,Würfel = ${sc.f_ck_cube} N/mm² | min. f_cm = ${sc.min_f_cm} N/mm²`
            : 'Wählen Sie eine Klasse gemäß statischen Anforderungen.';
    }

    // Sieve line hint
    const siebKey = elements.siebline.value;
    const sieb = SIEBLINIES[siebKey];
    if (elements.sieblinieHint) {
        const maxGrain = siebKey.replace(/[A-Z/]/g, '') || '?';
        elements.sieblinieHint.textContent = sieb
            ? `Max. Korngröße ${maxGrain} mm | k = ${sieb.k} | Wasserbedarf ${sieb.k < 3.5 ? 'niedrig' : sieb.k < 4.5 ? 'mittel' : 'hoch'}`
            : 'Sieblinie nicht gefunden.';
    }

    // Consistency class hint – warn when F4-F6 requires FM
    const cons = elements.consistencyClass.value;
    const admForHint = elements.admixtureType.value;
    const consHintEl = document.getElementById('consistencyHint');
    if (consHintEl) {
        if (['F4', 'F5', 'F6'].includes(cons) && admForHint !== 'FM') {
            consHintEl.textContent = `${cons}: Fließmittel (FM) nach B20 erforderlich – bitte unter "Verflüssigungsmittel" FM wählen.`;
            consHintEl.style.color = '#c0392b';
        } else if (['F4', 'F5', 'F6'].includes(cons) && admForHint === 'FM') {
            consHintEl.textContent = `${cons} + FM: Konsistenz wird durch Fließmittel erzeugt – Wasseransatz wie F3, FM reduziert Wasser und erhöht Fließfähigkeit.`;
            consHintEl.style.color = '#27ae60';
        } else {
            consHintEl.textContent = '';
            consHintEl.style.color = '';
        }
    }

    // Admixture hint
    const adm = elements.admixtureType.value;
    if (elements.admixtureHint) {
        if (adm === 'none') {
            elements.admixtureHint.textContent = 'Kein Zusatzmittel verwendet.';
        } else if (adm === 'BV') {
            elements.admixtureHint.textContent = `Betonverflüssiger: ~${getRecommendedWaterSaving('BV')} % Wasserersparnis | Dosierung ~${getAdmixtureDosage('BV')} l/m³`;
        } else if (adm === 'FM') {
            elements.admixtureHint.textContent = `Fließmittel: ~${getRecommendedWaterSaving('FM')} % Wasserersparnis | Dosierung ~${getAdmixtureDosage('FM')} l/m³`;
        }
    }

    // Use case hint
    if (elements.useCaseHint) {
        elements.useCaseHint.textContent = 'Setzt Voreinstellung für alle Parameter – einzelne Werte können danach angepasst werden.';
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
    const volume = Math.max(0.1, parseFloat(elements.volume.value) || 1);
    const strengthClass = elements.strengthClass.value || 'C20/25';
    const exposureClasses = getSelectedExposureClasses();
    const exposureClass = exposureClasses.length > 0 ? getGoverningExposureClass(exposureClasses) : null;

    return {
        useCase: elements.useCase.value || 'standard',
        volume,
        strengthClass,
        exposureClass: exposureClass || exposureClasses[0] || 'XC1',
        siebline: elements.siebline.value || 'B32',
        consistencyClass: elements.consistencyClass.value || 'F3',
        aggregateType: elements.aggregateType.value || 'Granit',
        cementType: elements.cementType.value || 'CEM I 42.5 N',
        vorhaltemas: Math.max(3, Math.min(12, parseFloat(elements.vorhaltemas.value) || 3)),
        admixtureType: elements.admixtureType.value || 'none',
        useAirEntraining: elements.useAirEntraining.checked,
        airEntrainingPercent: Math.max(0, Math.min(6, parseFloat(elements.airEntrainingPercent.value) || 0)),
        useFlyAsh: elements.useFlyAsh.checked,
        flyAshPercent: Math.max(0, Math.min(33, parseFloat(elements.flyAshPercent.value) || 0)),
        useSilicaFume: elements.useSilicaFume.checked,
        silicaFumePercent: Math.max(0, Math.min(11, parseFloat(elements.silicaFumePercent.value) || 0)),
        useWaterproofing: elements.useWaterproofing.checked,
        waterproofPercent: Math.max(0, Math.min(5, parseFloat(elements.waterproofPercent.value) || 0)),
        useMoisture: elements.useMoisture.checked,
        moisture0_2: parseFloat(elements.moisture0_2.value) || 5,
        moisture2_8: parseFloat(elements.moisture2_8.value) || 3,
        moisture8plus: parseFloat(elements.moisture8plus.value) || 2
    };
}

function calculateRecipe() {
    clearError();

    const values = collectFormValues();
    appState = { ...appState, ...values };

    // ── Step 1: Grenzwerte aus Expositionsklasse ──────────────────────────────
    const maxWz_exposure = getMaxWz(appState.exposureClass) || 0.75;

    // ── Step 2: Wassergehalt aus Sieblinie / Konsistenz ───────────────────────
    // F4–F6 require FM (Fließmittel) per B20 – fluidity is achieved via admixture
    const highConsistency = ['F4', 'F5', 'F6'].includes(appState.consistencyClass);
    if (highConsistency && appState.admixtureType !== 'FM') {
        return setError(`Konsistenzklasse ${appState.consistencyClass} erfordert Fließmittel (FM) nach B20. Bitte FM unter "Verflüssigungsmittel" wählen.`);
    }

    const baseWater = calculateWaterDemand(appState.siebline, appState.consistencyClass);
    if (baseWater === null) {
        return setError('Ungültige Sieblinie oder Konsistenzklasse, bitte prüfen.');
    }

    let waterTarget = baseWater;
    const isCrushed = /splitt/i.test(appState.aggregateType);
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
    const sigma = 3; // Standard-Streuung für gute Produktionsbedingungen
    const f_cm_target = calculateTargetStrengthWithMargin(f_ck_cube, sigma, appState.vorhaltemas);

    // ── Step 4: Maximaler w/z-Wert ────────────────────────────────────────────
    const cementMeta = getCementType(appState.cementType);
    const walzkurveKey = cementMeta ? cementMeta.walzkurveKey : '42.5';
    const cementDensity = cementMeta ? cementMeta.density : 3.0;

    let wz_walz = calculateWzFromTargetStrength(f_cm_target, walzkurveKey);
    let maxWz = maxWz_exposure;
    let wzSource = 'Expositionsklasse';

    if (wz_walz !== null) {
        // Betontechnologische Abminderung: –0.02 when Walzkurven w/z > exposure w/z
        const wz_walz_adj = wz_walz > maxWz_exposure ? wz_walz - 0.02 : wz_walz;
        if (wz_walz_adj < maxWz_exposure) {
            maxWz = wz_walz_adj;
            wzSource = 'Walzkurven (Festigkeit maßgebend)';
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

    // Enforce minimum cement from exposure class
    const exposureData = getExposureClass(appState.exposureClass);
    if (exposureData && cementAmount < exposureData.min_z) {
        cementAmount = exposureData.min_z;
    }
    cementAmount = Math.round(cementAmount);

    if (!cementAmount || cementAmount <= 0) {
        return setError('Berechnung des Zementgehalts fehlgeschlagen. Bitte Eingabewerte prüfen.');
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

    // Stoffraumrechnung: 1000 = z/ρz + w/ρw + f/ρf + s/ρs + g/ρg + LP
    const vz = cementAmount / cementDensity;
    const vw = waterTarget / 1.0;
    const vf = flyAshMass / flyAshDensity;
    const vs = silicaFumeMass / silicaDensity;
    const vLP = airVolumeDm3;
    const rhoG = getAverageDensity(appState.aggregateType) || 2.65;
    const vg = 1000 - vz - vw - vf - vs - vLP;
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
        wzWalz: wz_walz ? Math.round(wz_walz * 100) / 100 : null,
        wzSource,
        fCmTarget: f_cm_target,
        vorhaltemas: appState.vorhaltemas,
        sigma,
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
        stoffraum: { vz: Math.round(vz), vw: Math.round(vw), vf: Math.round(vf), vs: Math.round(vs), vLP, vg: Math.round(vg) }
    };

    appState.plausibilityWarnings = evaluatePlausibility(appState, recipe);

    // Fill effect list
    const effectNotes = [];
    if (appState.useAirEntraining) {
        effectNotes.push(`Luftporenbildner ${appState.airEntrainingPercent}% reduziert Wasserbedarf und Festigkeit. (ca. ${Math.round(appState.airEntrainingPercent * 3.5)} N/mm²)`);
    }
    if (appState.useFlyAsh) {
        effectNotes.push(`Flugasche ${appState.flyAshPercent}% – k=0.4, reduziert Zementbedarf und verbessert Dauerhaftigkeit.`);
    }
    if (appState.useSilicaFume) {
        effectNotes.push(`Silikastaub ${appState.silicaFumePercent}% – k=1.0, erhöht Festigkeit signifikant.`);
    }
    if (appState.useWaterproofing) {
        effectNotes.push(`WU-Additiv ${appState.waterproofPercent}% – erhöht Wasserdichtheit.`);
    }

    if (elements.effectsList) {
        elements.effectsList.innerHTML = effectNotes.map(note => `<li>${note}</li>`).join('');
        elements.additivesSummary.style.display = effectNotes.length ? 'block' : 'none';
    }

    displayRecipe(recipe);
}

function displayRecipe(recipe) {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();

    elements.resultsSection.style.display = 'block';

    elements.resStrength.textContent = `${appState.strengthClass} (f_cm,Ziel ≈ ${formatNumber(recipe.fCmTarget, 1)} N/mm²)`;
    elements.resVolume.textContent = `${appState.volume} m³`;

    // ── Plausibility warnings ─────────────────────────────────────────────────
    const existingWarnings = elements.resultsSection.querySelector('.plausibility-warning');
    if (existingWarnings) existingWarnings.remove();

    if (appState.plausibilityWarnings && appState.plausibilityWarnings.length > 0) {
        const warningsNode = document.createElement('div');
        warningsNode.className = 'plausibility-warning';
        warningsNode.innerHTML = `<h3>⚠️ Plausibilitätsprüfung</h3><ul>${appState.plausibilityWarnings.map(item => `<li>${item}</li>`).join('')}</ul>`;
        const calcDetails = elements.calcDetails;
        calcDetails.parentNode.insertBefore(warningsNode, calcDetails);
    }

    // ── Collapsible calculation steps (B20 Tafel 9) ──────────────────────────
    const wzWalzStr = recipe.wzWalz ? `w/z_Walz = ${recipe.wzWalz.toFixed(2)} (–0.02 Abminderung)` : '–';
    const eqWzStr = recipe.equivalentWz ? ` | (w/z)_eq = ${recipe.equivalentWz.toFixed(2)}` : '';
    const steps = [
        ['1', 'Grenzwerte (Expositionsklasse)', `max w/z = ${recipe.wzExposure.toFixed(2)}, min z = ${getExposureClass(appState.exposureClass)?.min_z ?? '–'} kg/m³`],
        ['2', 'Wassergehalt (Sieblinie / Konsistenz)', `erf. w = ${formatNumber(recipe.materials.water, 0)} l/m³`],
        ['3', 'Zielfestigkeit', `f_ck,Würfel = ${getStrengthClass(appState.strengthClass)?.f_ck_cube ?? '–'} N/mm² → f_cm,dry,cube = ${formatNumber(recipe.fCmTarget, 1)} N/mm² (σ=${recipe.sigma}, v=${recipe.vorhaltemas})`],
        ['4', 'max w/z-Wert', `${wzWalzStr} | Expositionsklasse: ${recipe.wzExposure.toFixed(2)} → maßgebend (${recipe.wzSource}): w/z = ${recipe.wzLimit.toFixed(2)}`],
        ['5', 'Zementgehalt', `z = w/(w/z) = ${formatNumber(recipe.materials.water,0)}/${recipe.wzLimit.toFixed(2)} = ${formatNumber(recipe.materials.cement,0)} kg/m³${eqWzStr}`],
        ['6', 'Stoffraumrechnung', `V_z=${recipe.stoffraum.vz} + V_w=${recipe.stoffraum.vw} + V_f=${recipe.stoffraum.vf + recipe.stoffraum.vs} + LP=${recipe.stoffraum.vLP} + V_g=${recipe.stoffraum.vg} = 1000 dm³`],
        ['7', 'Zugabewasser', `w_gesamt = ${formatNumber(recipe.materials.water,0)} l/m³ → Zugabewasser = ${formatNumber(recipe.materials.zugabewasser,0)} l/m³ (nach Feuchteabzug)`],
        ['8', 'Mehlkorngehalt', `Zement + Zusatzstoffe + Gesteinskörnungsanteil ≤0.125mm = ${formatNumber(recipe.mehlkorngehalt,0)} kg/m³`]
    ];

    elements.calcStepsBody.innerHTML = steps.map(([n, label, value]) =>
        `<tr><td class="step-num">${n}</td><td class="step-label">${label}</td><td class="step-value">${value}</td></tr>`
    ).join('');

    // ── Ingredients header ────────────────────────────────────────────────────
    const vol = appState.volume;
    elements.ingredientsHeader.textContent = `Zutaten für ${vol} m³:`;
    elements.volumeColHeader.textContent = vol !== 1 ? `Menge für ${vol} m³` : 'Menge gesamt';

    // ── Main ingredients table ────────────────────────────────────────────────
    const tableRows = [];

    const addRow = (name, perM3, unit, totalQty, totalUnit, note) => {
        tableRows.push(`<tr>
            <td>${name}</td>
            <td>${formatNumber(perM3, 1)} ${unit}/m³</td>
            <td>${formatNumber(totalQty, 1)} ${totalUnit}</td>
            <td>${note}</td>
        </tr>`);
    };

    addRow(appState.cementType, recipe.materials.cement, 'kg', recipe.materials.cement * vol, 'kg',
        `ρ = ${recipe.cementDensity} kg/dm³, V_z = ${recipe.stoffraum.vz} dm³/m³`);

    if (recipe.materials.flyAsh > 0) {
        addRow('Flugasche', recipe.materials.flyAsh, 'kg', recipe.materials.flyAsh * vol, 'kg', 'k = 0.4 (Zusatzstoff Typ II)');
    }
    if (recipe.materials.silicaFume > 0) {
        addRow('Silikastaub', recipe.materials.silicaFume, 'kg', recipe.materials.silicaFume * vol, 'kg', 'k = 1.0 (Zusatzstoff)');
    }

    // Water: show total water and Zugabewasser
    const zugRow = recipe.materials.zugabewasser !== recipe.materials.water
        ? ` | Zugabewasser: ${formatNumber(recipe.materials.zugabewasser * vol, 0)} l`
        : '';
    tableRows.push(`<tr>
        <td>Wasser (gesamt)</td>
        <td>${formatNumber(recipe.materials.water, 0)} l/m³</td>
        <td>${formatNumber(recipe.materials.water * vol, 0)} l${zugRow}</td>
        <td>w/z ≤ ${recipe.wzLimit.toFixed(2)}</td>
    </tr>`);

    if (appState.admixtureType !== 'none') {
        addRow(
            appState.admixtureType === 'BV' ? 'Betonverflüssiger (BV)' : 'Fließmittel (FM)',
            recipe.materials.admixture, 'l',
            recipe.materials.admixture * vol, 'l',
            `${getRecommendedWaterSaving(appState.admixtureType) ?? 0}% Wasserersparnis`
        );
    }

    // Aggregate: total row (detail breakdown follows in Korngruppen table)
    addRow(`Gesteinskörnung gesamt (${appState.aggregateType})`,
        recipe.materials.aggregate, 'kg',
        recipe.materials.aggregate * vol, 'kg',
        `ρ ≈ ${formatNumber(getAverageDensity(appState.aggregateType), 2)} kg/dm³, V_g = ${recipe.stoffraum.vg} dm³/m³`);

    if (recipe.airEntraining > 0) {
        tableRows.push(`<tr>
            <td>Luftporengehalt</td>
            <td>${recipe.airEntraining} Vol.-%</td>
            <td>${recipe.stoffraum.vLP} dm³/m³</td>
            <td>Frostsicherheit, ca. ${Math.round(recipe.airEntraining * 3.5)} N/mm² Festigkeitsverlust</td>
        </tr>`);
    }

    if (recipe.materials.waterproofing > 0) {
        addRow('WU-Additiv', recipe.materials.waterproofing, 'kg', recipe.materials.waterproofing * vol, 'kg', 'Erhöht Wasserdichtheit');
    }

    elements.recipeBody.innerHTML = tableRows.join('');

    // ── Korngruppen table ─────────────────────────────────────────────────────
    if (recipe.korngruppen && recipe.korngruppen.length > 0) {
        elements.kornGruppenSection.style.display = 'block';
        let kgRows = '';
        let totalDry = 0, totalMoist = 0;
        recipe.korngruppen.forEach(kg => {
            totalDry += kg.massDry;
            totalMoist += kg.massMoist;
            kgRows += `<tr>
                <td>${kg.range} mm</td>
                <td>${kg.pct}</td>
                <td>${formatNumber(kg.massDry * vol, 0)}</td>
                <td>${formatNumber(kg.moisturePct, 1)}</td>
                <td>${formatNumber(kg.massMoist * vol, 0)}</td>
            </tr>`;
        });
        kgRows += `<tr class="total-row">
            <td><strong>Summe</strong></td>
            <td>100</td>
            <td><strong>${formatNumber(totalDry * vol, 0)}</strong></td>
            <td>–</td>
            <td><strong>${formatNumber(totalMoist * vol, 0)}</strong></td>
        </tr>`;
        elements.kornGruppenBody.innerHTML = kgRows;

        const moistureTotal = Math.round((totalMoist - totalDry) * vol);
        elements.zugabewasserInfo.innerHTML =
            `<strong>Gesamtwasser:</strong> ${formatNumber(recipe.materials.water * vol, 0)} l &nbsp;–&nbsp; ` +
            `<strong>Oberflächenfeuchte:</strong> ${formatNumber(moistureTotal, 0)} l &nbsp;=&nbsp; ` +
            `<strong>Zugabewasser:</strong> ${formatNumber(recipe.materials.zugabewasser * vol, 0)} l`;
    } else {
        elements.kornGruppenSection.style.display = 'none';
    }

    // ── Mixing instructions ───────────────────────────────────────────────────
    const baseInstructions = [
        `${appState.cementType} und trockene Zuschläge gleichmäßig mischen.`,
        recipe.materials.flyAsh > 0 ? `Flugasche unterkneten.` : '',
        recipe.materials.silicaFume > 0 ? `Silikastaub gleichmäßig einmischen.` : '',
        recipe.materials.waterproofing > 0 ? `WU-Additiv einmischen.` : '',
        `Zugabewasser (${formatNumber(recipe.materials.zugabewasser * vol, 0)} l) langsam zugeben und gründlich mischen.`,
        recipe.airEntraining > 0 ? `Luftporenbildner nach Rezept dosieren.` : '',
        `Beton bis zur gewünschten Konsistenz durchmischen.`,
        `Sofort verbauen oder max. 30 min frische Lagerung beachten.`
    ].filter(ii => ii);

    elements.instructionList.innerHTML = baseInstructions.map(inst => `<li>${inst}</li>`).join('');
}

function initialize() {
    buildSelectOptions(elements.useCase, Object.entries(USE_CASES).map(([key, data]) => ({ value: key, label: data.label })), 'standard');
    buildSelectOptions(elements.strengthClass, getAvailableClasses().map(value => ({ value, label: value })), 'C20/25');
    buildExposureCheckboxes();

    // Build sieve line options with A/B16 and A/B32 included
    const sieblineOptions = Object.keys(GRAIN_GROUPS_BY_SIEBLINE).sort();
    buildSelectOptions(elements.siebline, sieblineOptions.map(v => ({ value: v, label: v })), 'B32');

    buildSelectOptions(elements.consistencyClass, getAvailableConsistencyClasses().map(value => ({ value, label: value })), 'F3');
    buildSelectOptions(elements.aggregateType, getAvailableAggregates().map(value => ({ value, label: value })), 'Granit');

    buildSelectOptions(elements.cementType,
        getAvailableCementTypes().map(v => ({ value: v, label: v })),
        'CEM I 42.5 N');

    buildSelectOptions(elements.admixtureType, [
        { value: 'none', label: 'Kein Zusatzmittel' },
        { value: 'BV', label: 'Betonverflüssiger (BV)' },
        { value: 'FM', label: 'Fließmittel (FM)' }
    ], 'none');

    applyUseCaseDefaults();
    updateOptionalSections();

    elements.useCase.addEventListener('change', () => { applyUseCaseDefaults(); calculateRecipe(); });
    elements.strengthClass.addEventListener('change', updateHints);
    elements.siebline.addEventListener('change', updateHints);
    elements.consistencyClass.addEventListener('change', updateHints);
    elements.admixtureType.addEventListener('change', updateHints);
    elements.useAirEntraining.addEventListener('change', updateOptionalSections);
    elements.useFlyAsh.addEventListener('change', updateOptionalSections);
    elements.useSilicaFume.addEventListener('change', updateOptionalSections);
    elements.useWaterproofing.addEventListener('change', updateOptionalSections);
    elements.useMoisture.addEventListener('change', () => { updateOptionalSections(); calculateRecipe(); });

    elements.volume.addEventListener('input', calculateRecipe);

    elements.calculateBtn.addEventListener('click', (event) => {
        event.preventDefault();
        calculateRecipe();
    });

    updateGoverningExposureInfo();
    calculateRecipe();
}

window.addEventListener('DOMContentLoaded', initialize);

// Export functions for test harnesses
export { initialize, calculateRecipe, collectFormValues, displayRecipe, elements, evaluatePlausibility, applyUseCaseDefaults };
