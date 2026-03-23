import { STRENGTH_CLASSES, getAvailableClasses, getStrengthClass, recommendStrengthClass } from './lib/strength.js';
import { getAvailableExposureClasses, getGoverningExposureClass, getMaxWz, recommendExposureClass, getExposureClass, satisfiesExposureRequirements } from './lib/exposure.js';
import { getAvailableSieblinies, getAvailableConsistencyClasses, calculateWaterDemand, adjustForAggregateType } from './lib/consistency.js';
import { getAvailableAggregates, getAverageDensity, stofraumrechnung } from './lib/densities.js';
import { calculateCementFromWz } from './lib/mix-design.js';
import { applyAdmixtureWaterReduction, adjustForAirEntraining, calculateEquivalentWzWithBoth, calculateMaxFlyAshContent, calculateMaxSilicaFumeContent, getAdmixtureDosage, getRecommendedWaterSaving } from './lib/additives.js';
import { calculateFinesContent, checkFinesLimits, calculatePasteVolume, checkPasteRequirements, checkCemIFlyAshSilicaFume } from './lib/fines-content.js';

const USE_CASES = {
    cheap:        { label: 'Billig (Cheap)', strength: 'C20/25', exposure: 'XC1', siebline: 'B32', consistency: 'F3', aggregateType: 'Granit', admixtureType: 'none' },
    standard:     { label: 'Standard', strength: 'C25/30', exposure: 'XC2', siebline: 'B32', consistency: 'F2', aggregateType: 'Betonsplitt', admixtureType: 'none' },
    strong:       { label: 'Stark', strength: 'C30/37', exposure: 'XC3', siebline: 'B32', consistency: 'F2', aggregateType: 'Betonsplitt', admixtureType: 'BV' },
    ultraStrong:  { label: 'Ultra stark', strength: 'C40/50', exposure: 'XC4', siebline: 'B32', consistency: 'F3', aggregateType: 'Betonsplitt', admixtureType: 'none' }
};

const elements = {
    useCase: document.getElementById('useCase'),
    volume: document.getElementById('volume'),
    strengthClass: document.getElementById('strengthClass'),
    exposureClassContainer: document.getElementById('exposureClassContainer'),
    siebline: document.getElementById('siebline'),
    consistencyClass: document.getElementById('consistencyClass'),
    aggregateType: document.getElementById('aggregateType'),
    admixtureType: document.getElementById('admixtureType'),
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
    calculateBtn: document.getElementById('calculateBtn'),
    resultsSection: document.getElementById('results'),
    additivesSummary: document.getElementById('additivesSummary'),
    effectsList: document.getElementById('effectsList'),
    resStrength: document.getElementById('resStrength'),
    resVolume: document.getElementById('resVolume'),
    recipeBody: document.getElementById('recipeBody'),
    instructionList: document.getElementById('instructionList'),
    ingredientsHeader: document.getElementById('ingredientsHeader')
};

let appState = {
    strengthClass: null,
    volume: 1,
    aggregateType: 'Granit',
    cementType: 'Portlandzement',
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

    // Paste volume check (Zementleimgehalt) - Tafel 9 Schritt
    const paste = calculatePasteVolume(recipe.materials.cement, recipe.materials.flyAsh, recipe.materials.silicaFume);
    if (paste && !checkPasteRequirements(paste, state.exposureClass).meetsRequirement) {
        warnings.push(`Zementleimgehalt ${formatNumber(paste.pasteVolume)} kg/m³ unterschreitet Mindestwert für Expositionsklasse ${state.exposureClass}.`);
    }

    // Fines content check (Mehlkorngehalt) - Tafel 9 Schritt 8
    const fines = calculateFinesContent({
        cement: recipe.materials.cement,
        flyAsh: recipe.materials.flyAsh,
        silicaFume: recipe.materials.silicaFume
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

    const presetBounds = {
        cheap:      { maxWZ: 0.80, minCement: 220, maxCement: 300 },
        standard:   { maxWZ: 0.75, minCement: 200, maxCement: 330 },
        strong:     { maxWZ: 0.70, minCement: 260, maxCement: 420 },
        ultraStrong:{ maxWZ: 0.60, minCement: 280, maxCement: 520 }
    };

    const preset = state.useCase;
    const bounds = presetBounds[preset];
    if (bounds) {
        const wzc = recipe.materials.water / recipe.materials.cement;
        if (wzc > bounds.maxWZ + 0.005) {
            warnings.push(`Plausibilitätscheck ${preset}: w/z ist zu hoch (${wzc.toFixed(2)} > ${bounds.maxWZ}).`);
        }
        if (recipe.materials.cement < bounds.minCement || recipe.materials.cement > bounds.maxCement) {
            warnings.push(`Plausibilitätscheck ${preset}: Zementmenge ${formatNumber(recipe.materials.cement,1)} kg außerhalb empfohlenem Bereich ${bounds.minCement}-${bounds.maxCement}.`);
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

    values.forEach(exposure => {
        const wrapper = document.createElement('label');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.margin = '0 8px 4px 0';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'exposureClass';
        checkbox.value = exposure;
        checkbox.style.marginRight = '4px';

        wrapper.appendChild(checkbox);
        wrapper.appendChild(document.createTextNode(exposure));

        elements.exposureClassContainer.appendChild(wrapper);
    });
}

function getSelectedExposureClasses() {
    return Array.from(elements.exposureClassContainer.querySelectorAll('input[name="exposureClass"]:checked')).map(i => i.value);
}

function getSingleCheckedExposure() {
    const selected = getSelectedExposureClasses();
    if (selected.length === 0) return null;
    return getGoverningExposureClass(selected);
}

function updateOptionalSections() {
    elements.airEntrainingContainer.style.display = elements.useAirEntraining.checked ? 'block' : 'none';
    elements.flyAshContainer.style.display = elements.useFlyAsh.checked ? 'block' : 'none';
    elements.silicaFumeContainer.style.display = elements.useSilicaFume.checked ? 'block' : 'none';
    elements.waterproofContainer.style.display = elements.useWaterproofing.checked ? 'block' : 'none';
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

    elements.useAirEntraining.checked = false;
    elements.useFlyAsh.checked = false;
    elements.useSilicaFume.checked = false;
    elements.useWaterproofing.checked = false;

    updateOptionalSections();
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
        admixtureType: elements.admixtureType.value || 'none',
        useAirEntraining: elements.useAirEntraining.checked,
        airEntrainingPercent: Math.max(0, Math.min(6, parseFloat(elements.airEntrainingPercent.value) || 0)),
        useFlyAsh: elements.useFlyAsh.checked,
        flyAshPercent: Math.max(0, Math.min(33, parseFloat(elements.flyAshPercent.value) || 0)),
        useSilicaFume: elements.useSilicaFume.checked,
        silicaFumePercent: Math.max(0, Math.min(11, parseFloat(elements.silicaFumePercent.value) || 0)),
        useWaterproofing: elements.useWaterproofing.checked,
        waterproofPercent: Math.max(0, Math.min(5, parseFloat(elements.waterproofPercent.value) || 0))
    };
}

function calculateRecipe() {
    clearError();

    const values = collectFormValues();

    appState = {
        ...appState,
        ...values,
        cementType: 'Portlandzement'
    };

    // determine exposure and constraints
    const maxWz = getMaxWz(appState.exposureClass) || 0.75;

    // water demand based on siebline/consistency
    const baseWater = calculateWaterDemand(appState.siebline, appState.consistencyClass);
    if (baseWater === null) {
        return setError('Ungültige Sieblinie oder Konsistenzklasse, bitte prüfen.');
    }

    let waterTarget = baseWater;

    // aggregate type adjustment (10% more for crushed stone / splitt)
    const isCrushed = /splitt/i.test(appState.aggregateType);
    waterTarget = adjustForAggregateType(waterTarget, isCrushed);

    // air entraining adjustment
    if (appState.useAirEntraining && appState.airEntrainingPercent > 0) {
        waterTarget = adjustForAirEntraining(waterTarget, appState.airEntrainingPercent);
    }

    // admixture adjustment
    if (appState.admixtureType && appState.admixtureType !== 'none') {
        waterTarget = applyAdmixtureWaterReduction(waterTarget, appState.admixtureType);
    }

    // Keep water target within reasonable limits
    waterTarget = Math.max(120, Math.min(waterTarget, 260));

    // cement calculation with max permitted w/z
    const cementAmount = calculateCementFromWz(waterTarget, maxWz);

    if (!cementAmount || cementAmount <= 0) {
        return setError('Berechnung des Zementgehalts fehlgeschlagen. Bitte Eingabewerte prüfen.');
    }

    // supplementary materials by percent of cement
    const flyAshMass = appState.useFlyAsh ? (cementAmount * appState.flyAshPercent) / 100 : 0;
    const silicaFumeMass = appState.useSilicaFume ? (cementAmount * appState.silicaFumePercent) / 100 : 0;
    const waterProofingMass = appState.useWaterproofing ? (cementAmount * appState.waterproofPercent) / 100 : 0;

    // w/z equivalent with additives
    let equivalentWz = null;
    if (flyAshMass > 0 || silicaFumeMass > 0) {
        equivalentWz = calculateEquivalentWzWithBoth(waterTarget, cementAmount, flyAshMass, silicaFumeMass);
    }

    const exposureClassDescription = appState.exposureClass;

    const densityResult = stofraumrechnung(cementAmount, waterTarget, 20 + (appState.useAirEntraining ? appState.airEntrainingPercent * 10 : 0), appState.aggregateType);
    const aggregateMass = densityResult ? densityResult.aggregate_mass : 0;

    const strengthMeta = getStrengthClass(appState.strengthClass);

    const recipe = {
        targetStrength: strengthMeta ? strengthMeta.f_ck_cyl + 8 : null,
        wzLimit: maxWz,
        materials: {
            cement: cementAmount,
            flyAsh: flyAshMass,
            silicaFume: silicaFumeMass,
            waterproofing: waterProofingMass,
            water: waterTarget,
            aggregate: aggregateMass,
            admixture: appState.admixtureType === 'none' ? 0 : getAdmixtureDosage(appState.admixtureType) || 0,
            admixtureUnit: 'Liter'
        },
        airEntraining: appState.useAirEntraining ? appState.airEntrainingPercent : 0
    };

    appState.plausibilityWarnings = evaluatePlausibility(appState, recipe);

    // Fill effect list
    const effectNotes = [];
    if (appState.useAirEntraining) {
        effectNotes.push(`Luftporenbildner ${appState.airEntrainingPercent}% reduziert Wasserbedarf und Festigkeit. (ca. ${Math.round(appState.airEntrainingPercent * 3.5)} N/mm²)`);
    }
    if (appState.useFlyAsh) {
        effectNotes.push(`Flugasche ${appState.flyAshPercent}% - k=0.4, reduziert Zementbedarf und verbessert Dauerhaftigkeit.`);
    }
    if (appState.useSilicaFume) {
        effectNotes.push(`Silikastaub ${appState.silicaFumePercent}% - k=1.0, erhöht Festigkeit signifikant.`);
    }
    if (appState.useWaterproofing) {
        effectNotes.push(`WU-Additiv ${appState.waterproofPercent}% - erhöht Wasserdurchlässigkeitsverhalten.`);
    }

    if (elements.effectsList) {
        elements.effectsList.innerHTML = effectNotes.map(note => `<li>${note}</li>`).join('');
        elements.additivesSummary.style.display = effectNotes.length ? 'block' : 'none';
    }

    displayRecipe(recipe);
}

function displayRecipe(recipe) {
    // Hide any error messages first
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();

    elements.resultsSection.style.display = 'block';
    if (typeof elements.resultsSection.scrollIntoView === 'function') {
        elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    elements.resStrength.textContent = `${appState.strengthClass} (f_cm ≈ ${recipe.targetStrength ?? 'n.b.'} N/mm²)`;
    elements.resVolume.textContent = `${appState.volume} m³`;

    // plausibility warnings in results
    const existingWarnings = elements.resultsSection.querySelector('.plausibility-warning');
    if (existingWarnings) existingWarnings.remove();

    if (appState.plausibilityWarnings && appState.plausibilityWarnings.length > 0) {
        const warningsNode = document.createElement('div');
        warningsNode.className = 'plausibility-warning';
        warningsNode.innerHTML = `<h3>⚠️ Plausibilitätsprüfung</h3><ul>${appState.plausibilityWarnings.map(item => `<li>${item}</li>`).join('')}</ul>`;
        elements.resultsSection.insertBefore(warningsNode, elements.resultsSection.querySelector('.recipe-summary').nextSibling);
    }

    elements.ingredientsHeader.textContent = `Zutaten für ${appState.volume} m³:`;

    const tableRows = [];
    const cementDisplay = formatNumber(recipe.materials.cement * appState.volume, 1);
    tableRows.push(`<tr><td>${appState.cementType}</td><td>${cementDisplay} kg</td><td>Grundzement</td></tr>`);

    if (recipe.materials.flyAsh > 0) {
        tableRows.push(`<tr><td>Flugasche</td><td>${formatNumber(recipe.materials.flyAsh * appState.volume, 1)} kg</td><td>Zusatzstoff (k=0.4)</td></tr>`);
    }
    if (recipe.materials.silicaFume > 0) {
        tableRows.push(`<tr><td>Silikastaub</td><td>${formatNumber(recipe.materials.silicaFume * appState.volume, 1)} kg</td><td>Zusatzstoff (k=1.0)</td></tr>`);
    }

    tableRows.push(`<tr><td>Wasser</td><td>${formatNumber(recipe.materials.water * appState.volume, 0)} l</td><td>w/z ≤ ${recipe.wzLimit}</td></tr>`);

    if (appState.admixtureType !== 'none') {
        tableRows.push(`<tr><td>${appState.admixtureType === 'BV' ? 'Betonverflüssiger (BV)' : 'Fließmittel (FM)'}</td><td>${formatNumber(recipe.materials.admixture * appState.volume, 2)} ${recipe.materials.admixtureUnit}</td><td>${getRecommendedWaterSaving(appState.admixtureType) ?? 0}% Wasserersparnis</td></tr>`);
    }

    tableRows.push(`<tr><td>Gesteinskörnung (${appState.aggregateType})</td><td>${formatNumber(recipe.materials.aggregate * appState.volume, 0)} kg</td><td>Rohdichte ~${formatNumber(getAverageDensity(appState.aggregateType), 2)} kg/dm³</td></tr>`);

    if (recipe.airEntraining > 0) {
        tableRows.push(`<tr><td>Luftporenbildner</td><td>${recipe.airEntraining}% Vol.</td><td>Frostsicherheit, ca. ${Math.round(recipe.airEntraining * 3.5)} N/mm² weniger Festigkeit</td></tr>`);
    }

    if (recipe.materials.waterproofing > 0) {
        tableRows.push(`<tr><td>WU-Additiv</td><td>${formatNumber(recipe.materials.waterproofing * appState.volume, 1)} kg</td><td>Erhöht Wasserdichtheit</td></tr>`);
    }

    elements.recipeBody.innerHTML = tableRows.join('');

    const baseInstructions = [
        `Zement und trockene Zuschläge gleichmäßig mischen.`,
        recipe.materials.flyAsh > 0 ? `Flugasche unterkneten.` : '',
        recipe.materials.silicaFume > 0 ? `Silikastaub gleichmäßig einmischen.` : '',
        recipe.materials.waterproofing > 0 ? `WU-Additiv einmischen.` : '',
        `Wasser langsam zugeben und gründlich mischen.`,
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
    buildSelectOptions(elements.siebline, getAvailableSieblinies().map(value => ({ value, label: value })), 'B32');
    buildSelectOptions(elements.consistencyClass, getAvailableConsistencyClasses().map(value => ({ value, label: value })), 'F3');
    buildSelectOptions(elements.aggregateType, getAvailableAggregates().map(value => ({ value, label: value })), 'Granit');
    buildSelectOptions(elements.admixtureType, [
        { value: 'none', label: 'Kein Zusatzmittel' },
        { value: 'BV', label: 'Betonverflüssiger (BV)' },
        { value: 'FM', label: 'Fließmittel (FM)' }
    ], 'none');

    applyUseCaseDefaults();
    updateOptionalSections();

    elements.useCase.addEventListener('change', () => { applyUseCaseDefaults(); calculateRecipe(); });
    elements.useAirEntraining.addEventListener('change', updateOptionalSections);
    elements.useFlyAsh.addEventListener('change', updateOptionalSections);
    elements.useSilicaFume.addEventListener('change', updateOptionalSections);
    elements.useWaterproofing.addEventListener('change', updateOptionalSections);

    elements.volume.addEventListener('input', calculateRecipe);

    elements.calculateBtn.addEventListener('click', (event) => {
        event.preventDefault();
        calculateRecipe();
    });

    calculateRecipe();
}

window.addEventListener('DOMContentLoaded', initialize);

// Export functions for test harnesses
export { initialize, calculateRecipe, collectFormValues, displayRecipe, elements, evaluatePlausibility, applyUseCaseDefaults };
