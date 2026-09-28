// recipe.js - B20 mix design as a pure function (no DOM, no i18n)
import { getStrengthClass, calculateTargetStrengthWithMargin, calculateWzFromTargetStrength, getCementType } from './strength.js';
import { getStrictestLimits } from './exposure.js';
import { calculateWaterDemand, adjustForAggregateType } from './consistency.js';
import { getAverageDensity } from './densities.js';
import { applyAdmixtureWaterReduction, adjustForAirEntraining, calculateEquivalentWzWithBoth, getAdmixtureDosage } from './additives.js';
import { getFinesFraction, distributeAggregateBySiebline, calculateZugabewasser } from './aggregate-gradation.js';

// Fully compacted concrete holds about 2 Vol.-% air without admixture
// (B 20 p. 5: "ca. 2 % Luftporen (20 l/m3)"). The LP field is the total target air
// content, so only the air above this is added by the air-entraining agent.
export const NATURAL_AIR_PCT = 2;
const LP_STRENGTH_LOSS_PER_PCT = 3.5;  // N/mm² per Vol.-% added air (B 20 Tafel 7)

/**
 * Calculate a concrete recipe per m³ according to Zement-Merkblatt B 20.
 * @param {object} state - Form values as returned by collectFormValues() in app.js
 * @param {string[]} exposureClasses - All selected exposure classes (strictest limits apply)
 * @returns {{recipe: object}|{error: string, params?: object}} Recipe, or an i18n error key
 */
export function computeRecipe(state, exposureClasses) {
    // ── Step 1: Grenzwerte aus allen Expositionsklassen (DIN 1045-2: strengste Werte) ─
    const strictLimits = getStrictestLimits(exposureClasses);
    const maxWz_exposure = strictLimits.maxWz < Infinity ? strictLimits.maxWz : 0.75;
    const minZ_eff = strictLimits.minZ;

    // ── Step 2: Wassergehalt aus Sieblinie / Konsistenz ───────────────────────
    // F4–F6 require FM (Fließmittel) per B20 – fluidity is achieved via admixture
    const highConsistency = ['F4', 'F5', 'F6'].includes(state.consistencyClass);
    if (highConsistency && state.admixtureType !== 'FM') {
        return { error: 'err.missing.fm', params: { cls: state.consistencyClass } };
    }

    const baseWater = calculateWaterDemand(state.siebline, state.consistencyClass);
    if (baseWater === null) {
        return { error: 'err.invalid' };
    }

    let waterTarget = baseWater;
    const isCrushed = /splitt/i.test(state.aggregateType) || state.aggregateType === 'Basalt' || state.aggregateType === 'Dichter Kalkstein';
    waterTarget = adjustForAggregateType(waterTarget, isCrushed);

    if (state.admixtureType && state.admixtureType !== 'none') {
        waterTarget = applyAdmixtureWaterReduction(waterTarget, state.admixtureType);
    }

    // After the plasticiser, as in B 20 Beispiel III: "w = 184 - 3 ∙ 5 = 169 l"
    const totalAirPct = state.useAirEntraining ? Math.max(NATURAL_AIR_PCT, state.airEntrainingPercent) : NATURAL_AIR_PCT;
    const addedAirPct = totalAirPct - NATURAL_AIR_PCT;
    if (addedAirPct > 0) {
        waterTarget = adjustForAirEntraining(waterTarget, addedAirPct);
    }

    waterTarget = Math.max(120, Math.min(waterTarget, 260));

    // ── Step 3: Zielwert der mittleren Betondruckfestigkeit ───────────────────
    const strengthMeta = getStrengthClass(state.strengthClass);
    const f_ck_cube = strengthMeta ? strengthMeta.f_ck_cube : 25;
    // The added air costs 3,5 N/mm² per Vol.-%, so the target rises by that much
    // (B 20 Beispiel III Variante 2: "... + 5 + 3 ∙ 3,5").
    const lpStrengthLoss = addedAirPct * LP_STRENGTH_LOSS_PER_PCT;
    const f_cm_target = Math.round((calculateTargetStrengthWithMargin(f_ck_cube, 0, state.vorhaltemas) + lpStrengthLoss) * 10) / 10;

    // ── Step 4: Maximaler w/z-Wert ────────────────────────────────────────────
    const cementMeta = getCementType(state.cementType);
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
    const alpha_FA = state.useFlyAsh    ? state.flyAshPercent    / 100 : 0;
    const alpha_SF = state.useSilicaFume ? state.silicaFumePercent / 100 : 0;
    const scmFactor = 1 + k_FA * alpha_FA + k_SF * alpha_SF;

    let cementAmount = waterTarget / (maxWz * scmFactor);

    // Enforce minimum cement from strictest of all selected exposure classes
    if (cementAmount < minZ_eff) {
        cementAmount = minZ_eff;
    }
    cementAmount = Math.round(cementAmount);

    if (!cementAmount || cementAmount <= 0) {
        return { error: 'err.cement' };
    }

    // Supplementary materials (fractions of the now-reduced cement content)
    const flyAshMass       = state.useFlyAsh       ? cementAmount * alpha_FA : 0;
    const silicaFumeMass   = state.useSilicaFume   ? cementAmount * alpha_SF : 0;
    const waterProofingMass = state.useWaterproofing ? (cementAmount * state.waterproofPercent) / 100 : 0;

    // Equivalent w/z (should equal maxWz exactly; shown in calculation steps)
    let equivalentWz = null;
    if (flyAshMass > 0 || silicaFumeMass > 0) {
        equivalentWz = calculateEquivalentWzWithBoth(waterTarget, cementAmount, flyAshMass, silicaFumeMass);
    }

    // ── Step 6: Stoffraumrechnung – Gesteinskörnung ───────────────────────────
    const airVolumeDm3 = totalAirPct * 10;
    const flyAshDensity = 2.3; // kg/dm³ (Tafel 6, middle of range 2.2–2.4)
    const silicaDensity = 2.2; // kg/dm³ (Tafel 6)

    // Stoffraumrechnung: 1000 = z/ρz + w/ρw + f/ρf + s/ρs + vWU + g/ρg + LP
    const vz = cementAmount / cementDensity;
    const vw = waterTarget / 1.0;
    const vf = flyAshMass / flyAshDensity;
    const vs = silicaFumeMass / silicaDensity;
    const vWU = waterProofingMass / 2.0; // WU-Additiv density ≈ 2.0 kg/dm³
    const vLP = airVolumeDm3;
    const rhoG = getAverageDensity(state.aggregateType) || 2.65;
    const vg = 1000 - vz - vw - vf - vs - vWU - vLP;
    const aggregateMass = Math.round(vg * rhoG);

    // ── Step 7: Korngruppen und Zugabewasser ──────────────────────────────────
    const moistures = state.useMoisture
        ? [state.moisture0_2, state.moisture2_8, state.moisture8plus]
        : [0, 0, 0];
    const korngruppen = distributeAggregateBySiebline(aggregateMass, state.siebline, moistures);
    const zugabewasser = korngruppen
        ? calculateZugabewasser(waterTarget, korngruppen)
        : Math.round(waterTarget);

    // ── Step 8: Mehlkorngehalt prüfen ────────────────────────────────────────
    const finesFromAggregate = aggregateMass * getFinesFraction(state.siebline);
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
        vorhaltemas: state.vorhaltemas,
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
            admixture: state.admixtureType === 'none' ? 0 : getAdmixtureDosage(state.admixtureType) || 0,
            admixtureUnit: 'Liter'
        },
        korngruppen,
        airEntraining: state.useAirEntraining ? state.airEntrainingPercent : 0,
        addedAirPct,
        lpStrengthLoss,
        equivalentWz,
        stoffraum: { vz: Math.round(vz), vw: Math.round(vw), vf: Math.round(vf), vs: Math.round(vs), vWU: Math.round(vWU), vLP, vg: Math.round(vg) }
    };

    return { recipe };
}
