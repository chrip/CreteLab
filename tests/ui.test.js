import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

// Load index.html content
const html = fs.readFileSync(path.resolve('index.html'), 'utf8');

describe('UI End-to-End Tests (JSDOM)', () => {
    let dom;
    let window;
    let document;

    // Setup JSDOM once for the entire suite to avoid ESM module caching issues
    // since app.js captures the global document at load time.
    async function setupUI() {
        dom = new JSDOM(html, { 
            runScripts: 'dangerously', 
            resources: 'usable',
            url: 'http://localhost/' 
        });
        window = dom.window;
        document = window.document;

        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.HTMLInputElement = window.HTMLInputElement;
        global.HTMLSelectElement = window.HTMLSelectElement;
        global.HTMLButtonElement = window.HTMLButtonElement;

        const { initialize } = await import('../js/app.js');
        initialize();
    }

    it('should initialize the form and calculate a basic recipe', async () => {
        await setupUI();

        const elements = {
            volume: document.getElementById('volume'),
            strengthClass: document.getElementById('strengthClass'),
            exposureClassContainer: document.getElementById('exposureClassContainer'),
            calculateBtn: document.getElementById('calculateBtn'),
            resStrength: document.getElementById('resStrength'),
            resVolume: document.getElementById('resVolume'),
            recipeBody: document.getElementById('recipeBody'),
            resultsSection: document.getElementById('results')
        };

        elements.volume.value = '2.5';
        elements.strengthClass.value = 'C25/30';

        const xc1Checkbox = elements.exposureClassContainer.querySelector('input[value="XC1"]');
        if (!xc1Checkbox) throw new Error('XC1 checkbox not found');
        xc1Checkbox.checked = true;
        xc1Checkbox.dispatchEvent(new window.Event('change'));

        elements.calculateBtn.click();

        assert.ok(!elements.resultsSection.classList.contains('hidden'), 'Results section should be visible');
        // Use regex to allow both 2,5 and 2.5 due to locale differences in JSDOM
        const heading = document.getElementById('results-title').textContent;
        assert.ok(/2[.,]5\s*m³/i.test(heading), `Expected volume 2,5 m³ in heading, got: ${heading}`);
        assert.ok(heading.includes('C25/30'), `Expected strength C25/30 in heading, got: ${heading}`);
        assert.ok(elements.recipeBody.innerHTML.length > 0, 'Recipe table should be populated');
        assert.ok(elements.recipeBody.textContent.includes('CEM I 42.5 N'), 'Cement should be present in the recipe');
    });

    it('should show error when no exposure class is selected', async () => {
        // We don't call setupUI() again because it would overwrite the global document 
        // but the app.js module is already initialized with the first document.
        
        const elements = {
            exposureClassContainer: document.getElementById('exposureClassContainer'),
            calculateBtn: document.getElementById('calculateBtn')
        };

        const checkboxes = elements.exposureClassContainer.querySelectorAll('input[name="exposureClass"]');
        checkboxes.forEach(cb => cb.checked = false);

        elements.calculateBtn.click();

        const error = document.querySelector('.error-message');
        assert.ok(error, 'Error message should be displayed');
        assert.ok(error.textContent.includes('Bitte wählen Sie mindestens eine Expositionsklasse aus'), 'Error message should warn about exposure class');
    });

    it('should handle various volume scales and maintain plausible precision', async () => {
        const volumes = ['1', '0.1', '0.01', '0.001'];
        
        const elements = {
            volume: document.getElementById('volume'),
            strengthClass: document.getElementById('strengthClass'),
            exposureClassContainer: document.getElementById('exposureClassContainer'),
            calculateBtn: document.getElementById('calculateBtn'),
            recipeBody: document.getElementById('recipeBody'),
            resultsSection: document.getElementById('results')
        };

        elements.strengthClass.value = 'C25/30';
        const xc1Checkbox = elements.exposureClassContainer.querySelector('input[value="XC1"]');
        xc1Checkbox.checked = true;

        for (const vol of volumes) {
            elements.volume.value = vol;
            elements.calculateBtn.click();

            assert.ok(!elements.resultsSection.classList.contains('hidden'), `Results should be visible for volume ${vol}`);
            
            const tableText = elements.recipeBody.textContent;
            assert.ok(!tableText.includes('NaN') && !tableText.includes('undefined'), `Values should be plausible for volume ${vol}`);
            
            if (vol === '0.001') {
                assert.ok(/[0-9][.,][0-9]{3}/.test(tableText), `Expected high precision (3 decimals) for volume 0.001, got: ${tableText}`);
            }
        }
    });

    it('should verify that 0.001m³ results are exactly 1/1000 of 1m³ results', async () => {
        const elements = {
            volume: document.getElementById('volume'),
            strengthClass: document.getElementById('strengthClass'),
            exposureClassContainer: document.getElementById('exposureClassContainer'),
            calculateBtn: document.getElementById('calculateBtn'),
            recipeBody: document.getElementById('recipeBody')
        };

        elements.strengthClass.value = 'C25/30';
        const xc1Checkbox = elements.exposureClassContainer.querySelector('input[value="XC1"]');
        xc1Checkbox.checked = true;

        const parseQuantity = (text) => {
            // Extract number and unit from string like "1.943 kg", "250 g", "0,18 l", "180 ml"
            const match = text.match(/([0-9.,]+)\s*([a-z]+)/i);
            if (!match) return null;
            
            const rawNum = match[1];
            const unit = match[2].toLowerCase();
            
            // Remove thousands separator (dot) and replace decimal separator (comma) with dot
            const normalizedNum = rawNum.replace(/\./g, '').replace(',', '.');
            let val = parseFloat(normalizedNum);
            
            // Normalize to base units (kg, l) for linearity comparison
            if (unit === 'g') val /= 1000;
            if (unit === 'ml') val /= 1000;
            
            return val;
        };

        // 1. Calculate for 1 m³
        elements.volume.value = '1';
        elements.calculateBtn.click();
        
        const getRecipeMap = () => {
            const map = new Map();
            const rows = Array.from(elements.recipeBody.querySelectorAll('tr'));
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    const name = cells[0].textContent.trim();
                    const qty = parseQuantity(cells[2].textContent);
                    if (name && qty !== null) map.set(name, qty);
                }
            });
            return map;
        };

        const map1m3 = getRecipeMap();

        // 2. Calculate for 0.001 m³
        elements.volume.value = '0.001';
        elements.calculateBtn.click();
        
        const map0001m3 = getRecipeMap();

        assert.strictEqual(map1m3.size, map0001m3.size, 'Both recipes should have the same number of ingredients');

        for (const [name, val1] of map1m3) {
            const val0001 = map0001m3.get(name);
            assert.ok(val0001 !== undefined, `Ingredient ${name} missing in 0.001m³ recipe`);
            
            // The expected value is val1 * 0.001
            const expected = val1 / 1000;
            
            // Log the values for the user to see the exact output
            console.log(`Ingredient: ${name.padEnd(30)} | 1m³: ${val1.toString().padStart(8)} | 0.001m³: ${val0001.toString().padStart(8)} | Expected: ${expected.toFixed(4).padStart(8)}`);

            // We use a relative epsilon because the values can vary from 0.001 to 2.0
            const diff = Math.abs(expected - val0001);
            const tolerance = Math.max(0.01, expected * 0.05); 
            
            assert.ok(diff < tolerance, 
                `Linearity failed for ${name}: 1m³=${val1}, 0.001m³=${val0001}. Expected approx ${expected.toFixed(4)}, diff=${diff.toFixed(4)}`);
        }
    });
});