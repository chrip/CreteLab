// app.js - CreteLab Concrete Recipe Calculator Main Application
// Betonrezept Rechner nach Zement-Merkblatt B 20

import { STRENGTH_CLASSES, getStrengthClass, calculateTargetStrength, recommendStrengthClass } from './lib/strength.js';
import { EXPOSURE_CLASSES, getExposureClass, getMaxWz, recommendExposureClass } from './lib/exposure.js';
import { SIEBLINIES, CONSISTENCY_CLASSES, calculateWaterDemand, adjustForAggregateType, getAvailableSieblinies, getAvailableConsistencyClasses } from './lib/consistency.js';
import { AGGREGATE_DENSITIES, ADDITIVE_DENSITIES, WATER_DENSITY, STOFFRAUM_CONSTANTS, stofraumrechnung, getAverageDensity, calculateVolume, calculateMass } from './lib/densities.js';

// Application state
const appState = {
    useCase: null,
    volume: null,
    strengthClass: 'C20/25',
    exposureClass: null,
    siebline: 'B32',
    consistencyClass: 'F3',
    aggregateType: 'Basalt',
    cementType: 'Portlandzement',
    useFlyAsh: false,
    useSilicaFume: false,
    useAirEntraining: false,
    flyAshContent: 0,
    silicaFumeContent: 0,
    airEntrainingPercent: 1.5,
    admixtureType: 'none',
    result: null
};

// DOM Elements
const elements = {
    // Form inputs
    useCase: document.getElementById('useCase'),
    volume: document.getElementById('volume'),
    strengthClass: document.getElementById('strengthClass'),
    exposureClass: document.getElementById('exposureClass'),
    siebline: document.getElementById('siebline'),
    consistencyClass: document.getElementById('consistencyClass'),
    aggregateType: document.getElementById('aggregateType'),
    
    // Admixtures and additives checkboxes and inputs
    admixtureType: document.getElementById('admixtureType'),
    admixtureHint: document.getElementById('admixtureHint'),
    useAirEntraining: document.getElementById('useAirEntraining'),
    airEntrainingPercent: document.getElementById('airEntrainingPercent'),
    airEntrainingContainer: document.getElementById('airEntrainingContainer'),
    useFlyAsh: document.getElementById('useFlyAsh'),
    flyAshPercent: document.getElementById('flyAshPercent'),
    flyAshContainer: document.getElementById('flyAshContainer'),
    useSilicaFume: document.getElementById('useSilicaFume'),
    silicaFumePercent: document.getElementById('silicaFumePercent'),
    silicaFumeContainer: document.getElementById('silicaFumeContainer'),
    useWaterproofing: document.getElementById('useWaterproofing'),
    waterproofPercent: document.getElementById('waterproofPercent'),
    waterproofContainer: document.getElementById('waterproofContainer'),
    
    // Buttons and results
    calculateBtn: document.getElementById('calculateBtn'),
    printBtn: document.getElementById('printBtn'),
    additivesSummary: document.getElementById('additivesSummary'),
    effectsList: document.getElementById('effectsList'),
    
    // Results display
    calculator: document.getElementById('calculator'),
    resultsSection: document.getElementById('results'),
    resStrength: document.getElementById('resStrength'),
    resVolume: document.getElementById('resVolume'),
    recipeBody: document.getElementById('recipeBody'),
    instructionList: document.getElementById('instructionList')
};

/**
 * Update admixture hint text based on selection
 */
function updateAdmixtureHint() {
    const value = elements.admixtureType.value;
    switch (value) {
        case 'none':
            elements.admixtureHint.textContent = 'Kein Zusatzmittel verwendet';
            break;
        case 'BV':
            elements.admixtureHint.textContent = 'Betonverflüssiger: ~7% weniger Wasser, bessere Verarbeitbarkeit';
            break;
        case 'FM':
            elements.admixtureHint.textContent = 'Fließmittel: ~20% weniger Wasser, sehr hohes Ausbreitmaß (selbstverdichtend)';
            break;
    }
}

/**
 * Setup event listeners for additive checkboxes to show/hide containers
 */
function setupAdditiveListeners() {
    // Admixture hint update
    elements.admixtureType.addEventListener('change', updateAdmixtureHint);
    updateAdmixtureHint(); // Initial call
    
    // Air entraining
    elements.useAirEntraining.addEventListener('change', function() {
        elements.airEntrainingContainer.style.display = this.checked ? 'block' : 'none';
    });
    
    // Fly ash
    elements.useFlyAsh.addEventListener('change', function() {
        elements.flyAshContainer.style.display = this.checked ? 'block' : 'none';
    });
    
    // Silica fume (Mikrosilika)
    elements.useSilicaFume.addEventListener('change', function() {
        elements.silicaFumeContainer.style.display = this.checked ? 'block' : 'none';
    });
    
    // Waterproofing
    elements.useWaterproofing.addEventListener('change', function() {
        elements.waterproofContainer.style.display = this.checked ? 'block' : 'none';
    });
}

/**
 * Initialize the application
 */
function init() {
    console.log('CreteLab initialized');
    
    // Set up event listeners - use submit to handle form submission properly
    elements.calculateBtn.addEventListener('click', handleCalculate);
    elements.printBtn.addEventListener('click', handlePrint);
    
    // Also add submit listener for form button type="submit"
    document.querySelector('#calculator').addEventListener('submit', function(e) {
        e.preventDefault();
    });
    
    // Load saved state from localStorage if available
    loadState();
}

/**
 * Save current state to localStorage
 */
function saveState() {
    const stateToSave = {
        useCase: appState.useCase,
        volume: appState.volume,
        strengthClass: appState.strengthClass,
        exposureClass: appState.exposureClass,
        siebline: appState.siebline,
        consistencyClass: appState.consistencyClass,
        aggregateType: appState.aggregateType,
        cementType: appState.cementType
    };
    
    try {
        localStorage.setItem('cretelab_state', JSON.stringify(stateToSave));
    } catch (e) {
        console.warn('Could not save state:', e);
    }
}

/**
 * Load saved state from localStorage
 */
function loadState() {
    try {
        const saved = localStorage.getItem('cretelab_state');
        if (!saved) return;
        
        const state = JSON.parse(saved);
        
        // Apply saved values to DOM
        if (state.useCase && elements.useCase.querySelector(`[value="${state.useCase}"]`)) {
            elements.useCase.value = state.useCase;
        }
        if (state.volume) elements.volume.value = state.volume;
        if (state.strengthClass && elements.strengthClass.querySelector(`[value="${state.strengthClass}"]`)) {
            elements.strengthClass.value = state.strengthClass;
        }
        if (state.exposureClass && elements.exposureClass.querySelector(`[value="${state.exposureClass}"]`)) {
            elements.exposureClass.value = state.exposureClass;
        }
    } catch (e) {
        console.warn('Could not load state:', e);
    }
}

/**
 * Handle calculate button click
 */
function handleCalculate() {
    // Validate inputs
    const useCase = elements.useCase.value;
    const volumeStr = elements.volume.value.trim();
    const volume = parseFloat(volumeStr);
    
    if (!useCase) {
        showError('Bitte wählen Sie einen Verwendungszweck aus.');
        return;
    }
    
    // Check if volume is empty or invalid - show user-friendly message
    if (volumeStr === '' || isNaN(volume) || volume <= 0) {
        showError('Bitte geben Sie ein gültiges Volumen an (z.B. 1 für 1 m³).');
        return;
    }
    
    // Update app state with all form values
    appState.useCase = useCase;
    appState.volume = volume;
    appState.strengthClass = elements.strengthClass.value;
    appState.exposureClass = elements.exposureClass.value || null;
    appState.siebline = elements.siebline.value;
    appState.consistencyClass = elements.consistencyClass.value;
    appState.aggregateType = elements.aggregateType.value;
    
    // Capture admixture and additive settings from form
    appState.admixtureType = elements.admixtureType.value; // 'none', 'BV', or 'FM'
    appState.useAirEntraining = elements.useAirEntraining.checked;
    appState.airEntrainingPercent = parseFloat(elements.airEntrainingPercent.value) || 0;
    appState.useFlyAsh = elements.useFlyAsh.checked;
    appState.flyAshPercent = parseFloat(elements.flyAshPercent.value) || 0;
    appState.useSilicaFume = elements.useSilicaFume.checked;
    appState.silicaFumePercent = parseFloat(elements.silicaFumePercent.value) || 0;
    appState.useWaterproofing = elements.useWaterproofing.checked;
    appState.waterproofPercent = parseFloat(elements.waterproofPercent.value) || 0;
    
    // Calculate recipe
    calculateRecipe();
}

/**
 * Get target w/z ratio based on strength class
 */
function getTargetWzRatio(strengthClass) {
    const wzRatios = {
        'C12/15': 0.75,
        'C16/20': 0.65,
        'C20/25': 0.58,
        'C25/30': 0.52,
        'C30/37': 0.48
    };
    return wzRatios[strengthClass] || 0.60; // default for C20/25
}

/**
 * Calculate concrete recipe based on current inputs
 */
function calculateRecipe() {
    try {
        const strengthClassData = getStrengthClass(appState.strengthClass);
        
        if (!strengthClassData) {
            showError('Ungültige Druckfestigkeitsklasse.');
            return;
        }
        
        // Get exposure class data (use auto-recommendation if not specified)
        let exposureClass = appState.exposureClass || recommendExposureClass(appState.useCase);
        
        const wzLimit = getMaxWz(exposureClass, true); // Apply betontechnologische Abminderung
        
        // Calculate water demand based on consistency
        const waterDemand = calculateWaterDemand(appState.siebline, appState.consistencyClass);
        if (!waterDemand) {
            showError('Berechnung des Wasseranspruchs fehlgeschlagen. Bitte prüfen Sie die Eingaben.');
            return;
        }
        
        // Determine if using crushed stone (higher water demand by 10%)
        const isCrushedStone = (appState.aggregateType === 'Granit' || appState.aggregateType === 'Basalt');
        let waterAmount = adjustForAggregateType(waterDemand, isCrushedStone);
        
        // Apply admixture effects - reduce water based on admixture type
        if (appState.admixtureType === 'BV') {
            // Betonverflüssiger: 5-10% water reduction (~7%)
            waterAmount = Math.round(waterAmount * 0.93);
        } else if (appState.admixtureType === 'FM') {
            // Fließmittel (superplasticizer): 15-25% water reduction (~20%)
            waterAmount = Math.round(waterAmount * 0.80);
        }
        
        // Apply air entraining - further reduce water by ~5l per 1% LP
        if (appState.useAirEntraining && appState.airEntrainingPercent > 0) {
            const lpWaterSaving = appState.airEntrainingPercent * 5; // ~5l per 1% LP
            waterAmount = Math.max(140, waterAmount - lpWaterSaving); // Minimum 140 l/m³ for workability
        }
        
        console.log('Final water amount:', waterAmount);
        
        // Calculate target w/z ratio based on strength class
        const targetWz = getTargetWzRatio(appState.strengthClass);
        
        // Calculate required cement content: z = w / (w/z)
        let cementContent = waterAmount / targetWz;
        
        // Adjust based on exposure class minimum cement content
        const exposureData = getExposureClass(exposureClass);
        if (exposureData && exposureData.min_z && exposureData.min_z > cementContent) {
            cementContent = exposureData.min_z;
        }
        
        // Ensure minimum cement content of 250 kg/m³ for durability
        cementContent = Math.max(cementContent, 250);
        
        // Calculate aggregate content using Stoffraumrechnung
        const airVolume = appState.useAirEntraining ? 20 + (appState.airEntrainingPercent * 10) : 20;
        const aggregateResult = stofraumrechnung(
            cementContent, 
            waterAmount, 
            airVolume, 
            appState.aggregateType
        );
        
        // Calculate total quantities for requested volume
        const scaleFactor = appState.volume;
        
        const wzLimitValue = wzLimit || 'unbeschränkt';
        
        const recipe = {
            strengthClass: appState.strengthClass,
            targetStrength: calculateTargetStrength(strengthClassData.f_ck_cyl),
            exposureClass: exposureClass,
            wzLimit: wzLimitValue,
            volume: appState.volume,
            
            materials: {
                cement: Math.round(cementContent * scaleFactor * 100) / 100,
                waterproofing: appState.useWaterproofing ? Math.round((cementContent * (appState.waterproofPercent / 100)) * scaleFactor * 100) / 100 : 0,
                water: Math.round(waterAmount * scaleFactor),
                aggregate: aggregateResult ? Math.round(aggregateResult.aggregate_mass * scaleFactor * 100) / 100 : null,
                
                flyAsh: appState.useFlyAsh ? Math.round(appState.flyAshPercent * cementContent * scaleFactor * 100) / 100 : 0,
                silicaFume: appState.useSilicaFume ? Math.round(appState.silicaFumePercent * cementContent * scaleFactor / 100) / 100 : 0,
            },
            
            totalCementitious: cementContent + (appState.useFlyAsh ? (cementContent * appState.flyAshPercent / 100) : 0),
            waterproofingEffect: appState.useWaterproofing && appState.waterproofPercent > 0 
                ? `WU-Additiv verbessert Wasserundurchlässigkeit` 
                : null,
            airEntraining: appState.useAirEntraining ? appState.airEntrainingPercent : null,
            effectiveWz: waterAmount / cementContent
        };
        
        // Store result and display
        appState.result = recipe;
        displayRecipe(recipe);
        displayAdditiveEffects(recipe);
        
    } catch (error) {
        console.error('Calculation error:', error);
        showError('Bei der Berechnung ist ein Fehler aufgetreten.');
    }
}

/**
 * Format a number for display - round to nearest integer or 1 decimal place if needed
 */
function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined) return '-';
    
    const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    
    // Format with German locale for thousands separator
    return new Intl.NumberFormat('de-DE', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: decimals 
    }).format(rounded);
}

/**
 * Display the calculated recipe on the page
 */
function displayRecipe(recipe) {
    // Hide any error messages first
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
    
    // Show results section and hide additives summary initially
    elements.resultsSection.style.display = 'block';
    elements.additivesSummary.style.display = 'none';
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Update summary with formatted values
    elements.resStrength.textContent = `${appState.strengthClass} (f_cm ≈ ${recipe.targetStrength} N/mm²)`;
    elements.resVolume.textContent = `${appState.volume} m³`;
    
    // Build recipe table rows array
    const tableRows = [];
    
    // Display cement content (rounded to nearest kg)
    const cementDisplay = formatNumber(recipe.materials.cement, 1);
    tableRows.push(`<tr><td>${appState.cementType}</td><td>${cementDisplay} kg</td><td>Grundzement</td></tr>`);
    
    // Display fly ash if used (Flugasche)
    if (recipe.materials.flyAsh > 0 || appState.useFlyAsh) {
        const flyAshDisplay = formatNumber(recipe.materials.flyAsh, 1);
        tableRows.push(`<tr><td>Flugasche</td><td>${flyAshDisplay} kg</td><td>Zusatzstoff (k=0.4), max. 33%</td></tr>`);
    }
    
    // Display silica fume if used (Silikastaub/Mikrosilika)
    if (recipe.materials.silicaFume > 0 || appState.useSilicaFume) {
        const silicaFumeDisplay = formatNumber(recipe.materials.silicaFume, 1);
        tableRows.push(`<tr><td>Silikastaub</td><td>${silicaFumeDisplay} kg</td><td>Zusatzstoff (k=1.0), max. 11%</td></tr>`);
    }
    
    // Display water content (whole liters) with admixture hint
    const waterDisplay = formatNumber(recipe.materials.water, 0);
    let wzNote = `w/z ≤ ${recipe.wzLimit}`;
    if (appState.admixtureType === 'BV') {
        wzNote += ' (mit Betonverflüssiger)';
    } else if (appState.admixtureType === 'FM') {
        wzNote += ' (mit Fließmittel)';
    }
    tableRows.push(`<tr><td>Wasser</td><td>${waterDisplay} l</td><td>${wzNote}</td></tr>`);
    
    // Display aggregate content with formatted density
    const aggDensity = getAverageDensity(appState.aggregateType);
    const aggMassDisplay = recipe.materials.aggregate ? formatNumber(recipe.materials.aggregate, 0) : '-';
    const aggDensityFormatted = aggDensity ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(aggDensity) : 'n.b.';
    tableRows.push(`<tr><td>Gesteinskörnung (${appState.aggregateType})</td><td>${aggMassDisplay} kg</td><td>Rohdichte ~${aggDensityFormatted} kg/dm³</td></tr>`);
    
    // Display air entraining if used
    if (recipe.airEntraining) {
        tableRows.push(`<tr><td>Luftporenbildner</td><td>${recipe.airEntraining}% Vol.</td><td>Frostsicherheit verbessert, ca. ${Math.round(recipe.airEntraining * 3.5)} N/mm² weniger Festigkeit</td></tr>`);
    }
    
    // Display waterproofing if used
    if (recipe.materials.waterproofing > 0 || appState.useWaterproofing) {
        const wpDisplay = formatNumber(recipe.materials.waterproofing, 1);
        tableRows.push(`<tr><td>WU-Additiv</td><td>${wpDisplay} kg</td><td>Verbessert Wasserundurchlässigkeit</td></tr>`);
    }
    
    elements.recipeBody.innerHTML = tableRows.join('');
    
    // Build instructions with additive-specific steps
    const baseInstructions = [
        `Zement und trockene Zuschläge gleichmäßig mischen.`,
        ...recipe.materials.flyAsh > 0 ? [`Flugasche unterkneten.`] : [],
        recipe.materials.silicaFume > 0 ? [`Silikastaub gleichmäßig einmischen (erhöht Festigkeit).`] : [],
        recipe.materials.waterproofing > 0 ? [`WU-Additiv beifügen für verbesserte Wasserundurchlässigkeit.`] : [],
        `Wasser langsam zugeben und gründlich mischen.`,
        recipe.airEntraining ? [`Luftporenbildner nach Rezept dosieren.`] : [],
        `Beton bis zur gewünschten Konsistenz durchmischen.`,
        'Sofort verbauen oder frische Lagerung beachten (max. 30 min bei normaler Temperatur).'
    ];
    
    elements.instructionList.innerHTML = baseInstructions.map(inst => `<li>${inst}</li>`).join('');
}

/**
 * Display additive effects summary if any additives are used
 */
function displayAdditiveEffects(recipe) {
    const effects = [];
    
    // Admixture effect
    if (appState.admixtureType === 'BV') {
        effects.push(`<li><strong>Betonverflüssiger:</strong> ~7% weniger Wasser, bessere Verarbeitbarkeit</li>`);
    } else if (appState.admixtureType === 'FM') {
        effects.push(`<li><strong>Fließmittel:</strong> ~20% weniger Wasser, selbstverdichtend, ca. 1cm Ausbreitmaß pro 0.1%</li>`);
    }
    
    // Air entraining effect
    if (appState.useAirEntraining && recipe.airEntraining) {
        const strengthLoss = Math.round(recipe.airEntraining * 3.5);
        effects.push(`<li><strong>Luftporenbildner:</strong> ${recipe.airEntraining}% Vol., ~${strengthLoss} N/mm² weniger Festigkeit, besser frostsicher</li>`);
    }
    
    // Fly ash effect
    if (appState.useFlyAsh) {
        effects.push(`<li><strong>Flugasche:</strong> ${formatNumber(recipe.materials.flyAsh)} kg/m³, vermindert Hydratationswärme, verbessert Dauerhaftigkeit</li>`);
    }
    
    // Silica fume effect
    if (appState.useSilicaFume) {
        effects.push(`<li><strong>Silikastaub:</strong> ${formatNumber(recipe.materials.silicaFume)} kg/m³, erhöht Festigkeit deutlich, verbessert Dichtheit</li>`);
    }
    
    // Waterproofing effect
    if (appState.useWaterproofing) {
        effects.push(`<li><strong>WU-Additiv:</strong> ${formatNumber(recipe.materials.waterproofing)} kg/m³, verbessert Wasserundurchlässigkeit</li>`);
    }
    
    if (effects.length > 0) {
        elements.additivesSummary.style.display = 'block';
        elements.effectsList.innerHTML = effects.join('');
    } else {
        elements.additivesSummary.style.display = 'none';
    }
}

/**
 * Show error message to user and hide recipe results
 */
function showError(message) {
    // Hide any previous recipe results
    elements.resultsSection.style.display = 'none';
    
    // Remove any existing error messages
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
    
    // Create and display new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `⚠️ ${message}`;
    
    elements.calculateBtn.parentNode.appendChild(errorDiv);
    
    // Scroll to error
    setTimeout(() => errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

/**
 * Handle print button click
 */
function handlePrint() {
    window.print();
}

/**
 * Handle form submission (prevent default for button type="submit")
 */
function handleFormSubmit(event) {
    event.preventDefault();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    init();
    setupAdditiveListeners();
});

// Export for testing
export default appState;
