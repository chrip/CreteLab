/**
 * Streamlined unit tests for B20 concrete mix calculations
 * Focus on outcome correctness and concrete recipe results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateWaterDemand, calculateAverageK, adjustForAggregateType, WATER_DEMAND_A32_PLASTIC, WATER_DEMAND_B32_PLASTIC, WATER_DEMAND_C32_PLASTIC, SPLIT_SURCHARGE } from '../js/lib/consistency.js';
import { getAverageDensity, stofraumrechnung } from '../js/lib/densities.js';
import { calculateEquivalentWz, calculateMaxFlyAshContent, calculateStrengthReduction, adjustForAirEntraining, calculateEquivalentWzWithBoth, validateUnderwaterConcrete } from '../js/lib/additives.js';
import { calculateTargetStrength, convertToDryCuring } from '../js/lib/mix-design.js';
import { getMaxWz } from '../js/lib/exposure.js';
import { calculateFreshConcreteTemperatureSimple, calculateFreshConcreteTemperatureDetailed } from '../js/lib/temperature.js';
import { calculateWetAggregateMass, calculateAggregateMoistureMass, calculateAddedWaterFromMoisture } from '../js/lib/moisture.js';

describe('B20 water demand and consistency', () => {
    it('calculates formula-based water demand for A32/F2 and B32/F2', () => {
        const resultA32 = calculateWaterDemand('A32', 'F2');
        const resultB32 = calculateWaterDemand('B32', 'F2');

        // Expected from w = 1200/(k+3)
        assert.ok(Math.abs(resultA32 - 141.5) < 0.5, `A32/F2 expected ≈141.5 got ${resultA32}`);
        assert.ok(Math.abs(resultB32 - 166.7) < 0.5, `B32/F2 expected ≈166.7 got ${resultB32}`);
        assert.strictEqual(resultA32, WATER_DEMAND_A32_PLASTIC, 'A32 plastic reference constant');
        assert.strictEqual(resultB32, WATER_DEMAND_B32_PLASTIC, 'B32 plastic reference constant');
    });

    it('averages k-value for A32 and B32 close to 4.84', () => {
        const avgK = calculateAverageK('A32', 'B32');
        assert.ok(Math.abs(avgK - 4.84) < 0.01);
    });
});

describe('Concrete temperature and moisture utilities', () => {
    it('calculates fresh concrete temperature for winter and hot scenario', () => {
        const tempWinter = calculateFreshConcreteTemperatureSimple(8, 5, 45);
        assert.ok(Math.abs(tempWinter - 13.3) < 0.1);

        const tempHot = calculateFreshConcreteTemperatureDetailed(340, 75, 1800, 27, 0, 0, 150, 25);
        assert.ok(Math.abs(tempHot - 32.1) < 0.1);
    });

    it('computes aggregate moisture changes and required addition water', () => {
        const m1 = calculateAggregateMoistureMass(685, 4.5);
        const m2 = calculateAggregateMoistureMass(463, 3.0);
        const m3 = calculateAggregateMoistureMass(704, 2.0);

        assert.ok(Math.abs(m1 - 30.8) < 0.5);
        assert.ok(Math.abs(m2 - 13.9) < 0.5);
        assert.ok(Math.abs(m3 - 14.1) < 0.5);

        const addedWater = calculateAddedWaterFromMoisture(190, [m1, m2, m3]);
        assert.ok(Math.abs(addedWater - 131.2) < 0.2);

        const wetAgg = calculateWetAggregateMass(685, 4.5);
        assert.ok(Math.abs(wetAgg - 715.8) < 0.3);
    });
});

describe('B20 aggregate and exposure adjustments', () => {
    it('increases water demand by ~10% for crushed stone', () => {
        const baseWater = calculateWaterDemand('B32', 'F3');
        const adjusted = adjustForAggregateType(baseWater, true);
        assert.ok(Math.abs(adjusted / baseWater - 1.10) < 0.01);
    });

    it('returns max w/z limits correctly for XC1/XC3/X0', () => {
        assert.strictEqual(getMaxWz('XC1'), 0.75);
        assert.strictEqual(getMaxWz('XC3'), 0.65);
        assert.strictEqual(getMaxWz('X0'), null);
    });
});

describe('B20 supplementary materials effects', () => {
    it('finds equivalent w/z falls when fly ash is added', () => {
        const withFlyAsh = calculateEquivalentWz(190, 290, 'Flugasche', 96);
        const withoutFlyAsh = calculateEquivalentWz(190, 290, 'Flugasche', 0);
        assert.ok(withFlyAsh < withoutFlyAsh);
    });

    it('calculates maximum fly ash content for 300kg cement correctly', () => {
        const maxFlyAsh = calculateMaxFlyAshContent(300);
        assert.ok(Math.abs(maxFlyAsh - 99) < 2);
    });
});

describe('Underwater concrete requirements', () => {
    it('validates underwater specialty mix constraints', () => {
        const result = validateUnderwaterConcrete({
            cement: 310,
            flyAsh: 40,
            wzEquivalent: 0.53,
            finesContent: 360,
            kValue: 0.7
        });

        assert.strictEqual(result.valid, true);
        assert.deepStrictEqual(result.errors, []);
    });

    it('rejects missing minimum cement+fly ash and excessive w/z', () => {
        const result = validateUnderwaterConcrete({
            cement: 280,
            flyAsh: 50,
            wzEquivalent: 0.65,
            finesContent: 300,
            kValue: 0.65
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.length >= 3);
    });
});

describe('B20 air entrainment and strength adjustments', () => {
    it('reduces water by approx 5L per 1% LP', () => {
        const baseWater = 180;
        const reduced = adjustForAirEntraining(baseWater, 4);
        assert.ok(Math.abs((baseWater - reduced) - 20) < 1);
    });

    it('reduces strength by 3.5 per percent of LP', () => {
        const reduced = calculateStrengthReduction(40, 6);
        assert.ok(Math.abs((40 - reduced) - 21) < 1);
    });
});

describe('B20 material density and volume check', () => {
    it('gets reasonable aggregate densities and compute mass in stofraumrechnung', () => {
        const granularDensity = getAverageDensity('Granit');
        assert.ok(granularDensity >= 2.6 && granularDensity <= 2.8);

        const mix = stofraumrechnung(300, 150, 20, 'Granit');
        const totalVolume = mix.cement_volume + mix.water_volume + mix.air_volume + mix.aggregate_volume;
        assert.ok(Math.abs(totalVolume - 1000) < 40);
        assert.ok(mix.aggregate_mass > 1800 && mix.aggregate_mass < 2100);
    });
});

describe('B20 strength and curing conversion', () => {
    it('computes target strength from characteristic value', () => {
        assert.strictEqual(calculateTargetStrength(20), 28);
        assert.strictEqual(calculateTargetStrength(30), 38);
    });

    it('converts wet curing to dry curing strength appropriately', () => {
        const converted = convertToDryCuring(34);
        assert.ok(Math.abs(converted - 36.96) < 0.5);
    });
});

describe('B20 combined supplementary materials mix outcome', () => {
    it('computes equivalent w/z with both fly ash and silica fume', () => {
        const result = calculateEquivalentWzWithBoth(190, 280, 50, 20);
        assert.ok(result > 0 && result < 1);
        assert.ok(result < calculateEquivalentWzWithBoth(190, 280, 0, 0));
    });
});

describe('B20 app integration with DOM', () => {
    it('runs calculateRecipe end-to-end against the UI layout', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const { JSDOM } = await import('jsdom');

        const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });

        global.window = dom.window;
        global.document = dom.window.document;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;
        global.HTMLSelectElement = dom.window.HTMLSelectElement;
        global.Node = dom.window.Node;

        const app = await import('../js/app.js');

        // Parametric input values
        app.elements.volume.value = '0.7';
        app.elements.strengthClass.value = 'C25/30';
        app.elements.siebline.value = 'B32';
        app.elements.consistencyClass.value = 'F3';
        app.elements.aggregateType.value = 'Granit';

        app.elements.useFlyAsh.checked = true;
        app.elements.flyAshPercent.value = '10';
        app.elements.useAirEntraining.checked = true;
        app.elements.airEntrainingPercent.value = '3';

        app.updateOptionalSections?.();

        app.elements.resultsSection.scrollIntoView = () => {};

        await app.initialize();

        app.elements.volume.value = '0.7';
        app.elements.strengthClass.value = 'C25/30';
        app.elements.siebline.value = 'B32';
        app.elements.consistencyClass.value = 'F3';
        app.elements.aggregateType.value = 'Granit';

        app.elements.useFlyAsh.checked = true;
        app.elements.flyAshPercent.value = '10';
        app.elements.useAirEntraining.checked = true;
        app.elements.airEntrainingPercent.value = '3';

        app.updateOptionalSections?.();
        app.elements.resultsSection.scrollIntoView = () => {};

        app.calculateRecipe();

        assert.ok(app.elements.resultsSection.style.display === 'block');
        assert.ok(app.elements.recipeBody.innerHTML.includes('Wasser'));
        assert.ok(app.elements.instructionList.children.length > 0);
    });

    it('checks plausibility for the four default presets', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const { JSDOM } = await import('jsdom');

        const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });

        global.window = dom.window;
        global.document = dom.window.document;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;
        global.HTMLSelectElement = dom.window.HTMLSelectElement;
        global.Node = dom.window.Node;

        const app = await import('../js/app.js');

        const presets = ['cheap', 'standard', 'strong', 'ultraStrong'];

        for (const preset of presets) {
            app.elements.useCase.value = preset;
            app.applyUseCaseDefaults?.();
            app.calculateRecipe();

            const warningItems = app.elements.resultsSection.querySelectorAll('.plausibility-warning li');
            assert.ok(warningItems.length === 0, `Preset ${preset} should have no plausibility warnings, but got ${warningItems.length}`);

            assert.ok(app.elements.resultsSection.style.display === 'block');
            assert.ok(app.elements.recipeBody.innerHTML.includes('Wasser'));
        }
    });

    it('updates recipe display when volume input changes', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const { JSDOM } = await import('jsdom');

        const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });

        global.window = dom.window;
        global.document = dom.window.document;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;
        global.HTMLSelectElement = dom.window.HTMLSelectElement;
        global.Node = dom.window.Node;

        const app = await import('../js/app.js');

        await app.initialize();

        // Set initial volume
        app.elements.volume.value = '1';
        app.calculateRecipe();

        // Check initial header
        assert.ok(app.elements.ingredientsHeader.textContent.includes('1 m³'));

        // Change volume and trigger input event
        app.elements.volume.value = '2';
        app.elements.volume.dispatchEvent(new dom.window.Event('input'));

        // Check updated header
        assert.ok(app.elements.ingredientsHeader.textContent.includes('2 m³'));
    });
});
