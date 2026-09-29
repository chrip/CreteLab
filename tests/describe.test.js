import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseVolume, factsToValues, isDiyPiece, chooseDiyPreset, DIY_DEFAULT_VOLUME_M3 } from '../js/lib/describe.js';
import { computeRecipe } from '../js/lib/recipe.js';
import { getUhpcPreset } from '../js/lib/uhpc-presets.js';
import { computeUhpcRecipe } from '../js/lib/uhpc-engine.js';

const noul = p => ({ noul: p });

function answers({ indoor = 0, rain = 0, ground = 0, frost = 0, salt = 0, horizontal = 0,
                   reinforced = 0, watertight = 0, traffic = 0, element = 'slab', fineCast = 0 } = {}) {
    return {
        fine_cast: noul(fineCast),
        indoor_dry: noul(indoor), rain: noul(rain), ground: noul(ground), frost: noul(frost),
        deicing_salt: noul(salt), horizontal: noul(horizontal), reinforced: noul(reinforced),
        watertight: noul(watertight), traffic: { score: traffic }, element: { choice: element }
    };
}

describe('parseVolume', () => {
    const cases = [
        ['Ich brauche 2,5 m³ für den Keller', 2.5, 'volume'],
        ['3 Kubik Beton fürs Fundament', 3, 'volume'],
        ['halber Kubik reicht', 0.5, 'volume'],
        ['500 Liter für Pfosten', 0.5, 'volume'],
        ['Fundament für Gartenhaus 3x2 m, 20 cm dick', 1.2, 'dimensions'],
        ['Einfahrt 25 m² und 15 cm stark', 3.75, 'dimensions'],
        ['Punktfundament 40x40x80 cm', 0.13, 'dimensions'],
        ['slab 4 x 3 m, 12 cm thick', 1.44, 'dimensions'],
        ['Terrasse hinterm Haus', 1, 'default'],
        ['Terrasse 20 qm', 1, 'default']   // area without thickness is not a volume
    ];
    for (const [text, volume, source] of cases) {
        it(`${text} -> ${volume} m³ (${source})`, () => {
            const r = parseVolume(text);
            assert.strictEqual(r.source, source);
            assert.strictEqual(r.volume, volume);
        });
    }
});

describe('factsToValues', () => {
    it('driveway with frost and de-icing salt -> XC4, XD3, XF4, XM1, LP, C30/37', () => {
        const r = factsToValues(answers({ rain: 1, frost: 1, salt: 1, horizontal: 1, reinforced: 1, traffic: 2, element: 'paving' }));
        assert.deepStrictEqual(r.exposureClasses, ['XC4', 'XD3', 'XF4', 'XM1']);
        assert.strictEqual(r.values.useAirEntraining, true);
        assert.strictEqual(r.values.consistencyClass, 'F2');
        assert.strictEqual(r.values.strengthClass, 'C35/45'); // XD3 needs C35/45
    });

    it('dry indoor wall, reinforced -> XC1, B16, C20/25', () => {
        const r = factsToValues(answers({ indoor: 1, reinforced: 1, element: 'wall' }));
        assert.deepStrictEqual(r.exposureClasses, ['XC1']);
        assert.strictEqual(r.values.siebline, 'B16');
        assert.strictEqual(r.values.strengthClass, 'C20/25');
    });

    it('unreinforced shed foundation in the ground -> no XC class, frost -> XF1', () => {
        const r = factsToValues(answers({ ground: 1, frost: 1, element: 'foundation' }));
        assert.deepStrictEqual(r.exposureClasses, ['XF1']);
        assert.strictEqual(r.values.useAirEntraining, false);
        assert.strictEqual(r.values.strengthClass, 'C25/30');
    });

    it('unreinforced dry indoor -> X0', () => {
        const r = factsToValues(answers({ indoor: 1 }));
        assert.deepStrictEqual(r.exposureClasses, ['X0']);
    });

    it('basement in groundwater -> XC2 plus waterproofing admixture', () => {
        const r = factsToValues(answers({ ground: 1, reinforced: 1, watertight: 1, element: 'wall' }));
        assert.deepStrictEqual(r.exposureClasses, ['XC2']);
        assert.strictEqual(r.values.useWaterproofing, true);
    });

    it('every mapped result goes through the B20 engine without error', () => {
        const combos = [
            answers({ rain: 1, frost: 1, salt: 1, horizontal: 1, reinforced: 1, traffic: 2, element: 'paving' }),
            answers({ indoor: 1, reinforced: 1, element: 'wall' }),
            answers({ ground: 1, frost: 1, element: 'foundation' }),
            answers({ ground: 1, reinforced: 1, watertight: 1, element: 'wall' }),
            answers({ indoor: 1, reinforced: 1, horizontal: 1, traffic: 3, element: 'slab' }),
            answers({ rain: 1, frost: 1, horizontal: 1, element: 'small' })
        ];
        for (const a of combos) {
            const { values, exposureClasses } = factsToValues(a);
            const result = computeRecipe({ volume: 1, ...values }, exposureClasses);
            assert.ok(result.recipe, `engine error ${result.error} for ${exposureClasses}`);
            assert.ok(result.recipe.materials.cement >= result.recipe.minZeff);
        }
    });
});

describe('DIY route', () => {
    it('keeps litre precision for small pieces: Tischplatte 120x60x3 cm -> 21.6 l', () => {
        assert.deepStrictEqual(parseVolume('Tischplatte 120x60x3 cm').volume, 0.0216);
    });

    it('assumes 10 l for a DIY piece without a size', () => {
        const r = parseVolume('Blumenkübel gießen', { defaultVolume: DIY_DEFAULT_VOLUME_M3 });
        assert.deepStrictEqual(r, { volume: 0.01, source: 'default' });
    });

    it('site concrete still defaults to 1 m³', () => {
        assert.strictEqual(parseVolume('Terrasse hinterm Haus').volume, 1);
    });

    it('routes on fine_cast', () => {
        assert.strictEqual(isDiyPiece(answers({ fineCast: 0.9 })), true);
        assert.strictEqual(isDiyPiece(answers({ fineCast: 0.1 })), false);
    });

    it('outdoor DIY piece -> the mix the source calls weather-resistant', () => {
        const pick = chooseDiyPreset(answers({ fineCast: 1, rain: 1, frost: 1 }), { volume: 0.01, source: 'default' });
        assert.strictEqual(pick.presetKey, 'diy-white-15kg-laminate');
    });

    it('small indoor piece (<= 5 l stated) -> hand-mixed small batch', () => {
        const pick = chooseDiyPreset(answers({ fineCast: 1, indoor: 1 }), parseVolume('Obstschale, ca. 3 Liter'));
        assert.strictEqual(pick.presetKey, 'diy-white-bowl-4kg');
    });

    it('indoor furniture, or no size given -> furniture fine mortar', () => {
        const pick = chooseDiyPreset(answers({ fineCast: 1, indoor: 1 }), { volume: 0.01, source: 'default' });
        assert.strictEqual(pick.presetKey, 'diy-pce-30l-batch');
    });

    it('every DIY preset scales to 10 l with the UHPC engine', () => {
        for (const key of ['diy-white-15kg-laminate', 'diy-white-bowl-4kg', 'diy-pce-30l-batch']) {
            const r = computeUhpcRecipe(getUhpcPreset(key), DIY_DEFAULT_VOLUME_M3);
            assert.ok(r.cementKg > 3 && r.cementKg < 10, `${key}: ${r.cementKg} kg cement for 10 l`);
        }
    });
});

describe('parseVolume: hollow cast pieces (one side open unless stated)', () => {
    const cases = [
        // text, volume m³, open
        ['ein imperialer sitzwürfel cubisch, 90 cm Seitenlänge wandicke 2 cm, für den Garten', 0.0782, 'one'], // 0,9³ − 0,86·0,86·0,88
        ['Blumenkübel 40x40x40 cm, Wandstärke 2 cm', 0.0148, 'one'],              // 0,064 − 0,36·0,36·0,38
        ['Pflanzkübel 60x30x40 cm, 3 cm Wand', 0.024, 'one'],                      // 0,072 − 0,54·0,24·0,37
        ['Garden cube seat 45 cm, wall thickness 2 cm', 0.0188, 'one'],
        ['Hohlwürfel geschlossen, Kantenlänge 50 cm, Wandstärke 3 cm', 0.0398, 'none'], // 0,125 − 0,44³
        ['Betonring 60x60x30 cm ohne Boden, Wand 4 cm', 0.0269, 'both']           // 0,3 · (0,36 − 0,52²)
    ];
    for (const [text, volume, open] of cases) {
        it(`${text} -> ${volume * 1000} l (${open})`, () => {
            const r = parseVolume(text);
            assert.strictEqual(r.source, 'hollow');
            assert.strictEqual(r.open, open);
            assert.strictEqual(r.volume, volume);
        });
    }

    it('a slab thickness ("20 cm dick") is not a wall', () => {
        assert.deepStrictEqual(parseVolume('Fundament für ein Gartenhaus 3x2 m, 20 cm dick').source, 'dimensions');
    });

    it('a bare "Wand" needs mm or cm to count as wall thickness', () => {
        assert.notStrictEqual(parseVolume('Kellerwand 5x3x2 m').source, 'hollow');
    });
});
