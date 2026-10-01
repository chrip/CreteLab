<template>
  <div class="form">
    <div class="grid">
      <div class="field">
        <label :for="`${id}-volume`">{{ $t('details.volume') }}</label>
        <NumberInput :id="`${id}-volume`" v-model="volumeField" :min="0.0001" :max="10000" :digits="4" />
      </div>
      <div class="field">
        <label :for="`${id}-strength`">{{ $t('details.strength') }}</label>
        <select :id="`${id}-strength`" v-model="mix.strengthClass">
          <option v-for="c in STRENGTH_CLASS_NAMES" :key="c" :value="c">{{ c }} – {{ $t(`option.strength.${key(c)}`) }}</option>
        </select>
        <span v-if="tooWeak" class="hint warn-text">{{ $t('details.tooWeak', { min: tooWeak }) }}</span>
      </div>
      <div class="field">
        <label :for="`${id}-sieve`">{{ $t('details.sieveLine') }}</label>
        <select :id="`${id}-sieve`" v-model="mix.sieveLine">
          <option v-for="s in SIEVE_LINE_NAMES" :key="s" :value="s">{{ $t(`option.sieve.${key(s)}`) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-cons`">{{ $t('details.consistency') }}</label>
        <select :id="`${id}-cons`" v-model="mix.consistency">
          <option v-for="c in CONSISTENCY_CLASSES" :key="c" :value="c">{{ $t(`option.consistency.${c}`) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-agg`">{{ $t('details.aggregate') }}</label>
        <select :id="`${id}-agg`" v-model="mix.aggregate">
          <option v-for="a in AGGREGATE_TYPES" :key="a" :value="a">{{ $t(`option.aggregate.${a}`) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-cem`">{{ $t('details.cement') }}</label>
        <select :id="`${id}-cem`" v-model="mix.cementType">
          <option v-for="c in CEMENT_TYPE_NAMES" :key="c" :value="c">{{ c }} – {{ $t(`option.cement.${key(c)}`) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-margin`">{{ $t('details.margin') }}</label>
        <NumberInput :id="`${id}-margin`" v-model="marginField" :min="3" :max="12" :digits="1" />
        <span class="hint">{{ $t('details.marginHint') }}</span>
      </div>
    </div>

    <fieldset>
      <legend>{{ $t('details.exposure') }}</legend>
      <div v-for="group in EXPOSURE_GROUPS" :key="group.id" class="exposure-group">
        <span class="small muted">{{ $t(`option.exposureGroup.${group.id}`) }}</span>
        <label v-for="c in group.classes" :key="c" class="check exposure" :title="$t(`option.exposure.${c}.description`)">
          <input v-model="mix.exposureClasses" type="checkbox" :value="c" />
          <span><strong>{{ c }}</strong> {{ $t(`option.exposure.${c}.name`) }}</span>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>{{ $t('details.moistureTitle') }}</legend>
      <p class="small muted">{{ $t('details.moistureLead') }}</p>
      <span class="check toggle">
        <input v-model="useMoisture" type="checkbox" :aria-labelledby="`${id}-moisture`" />
        <strong :id="`${id}-moisture`">{{ $t('details.moisture') }}</strong>
      </span>
      <div class="grid">
        <div v-for="(label, i) in ['0/2', '2/8', '8+']" :key="label" class="field" :class="{ disabled: !mix.moisture }">
          <label :for="`${id}-mo${i}`">{{ $t('details.moistureGroup', { group: label }) }}</label>
          <NumberInput :id="`${id}-mo${i}`" v-model="moistureFields[i]!.value" :max="20" :digits="1" :disabled="!mix.moisture" />
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>{{ $t('details.admixtures') }}</legend>
      <p class="small muted">{{ $t('details.admixturesLead') }}</p>
      <div class="addition" :class="{ off: !plasticizerOn }">
        <span class="check">
          <input v-model="plasticizerOn" type="checkbox" :aria-labelledby="`${id}-add-plasticizer`" />
          <strong :id="`${id}-add-plasticizer`">{{ $t('details.add.plasticizer') }}</strong>
        </span>
        <select v-model="plasticizerKind" :aria-label="$t('details.add.plasticizer')" :disabled="!plasticizerOn">
          <option v-for="p in PLASTICIZERS.filter((p) => p !== 'none')" :key="p" :value="p">{{ $t(`option.plasticizer.${p}`) }}</option>
        </select>
        <p class="small muted">{{ $t('details.add.plasticizerNote') }}</p>
      </div>
      <div v-for="a in ADMIXTURES" :key="a.key" class="addition" :class="{ off: !a.field.on.value }">
        <!-- Only the box itself toggles: a click beside the dose must not switch it off. -->
        <span class="check">
          <input v-model="a.field.on.value" type="checkbox" :aria-labelledby="`${id}-add-${a.key}`" />
          <strong :id="`${id}-add-${a.key}`">{{ $t(`details.add.${a.key}`) }}</strong>
        </span>
        <span class="amount">
          <NumberInput v-model="a.field.value.value" :max="a.max()" :digits="1" :disabled="!a.field.on.value" :aria-label="$t(`details.add.${a.key}Unit`)" />
          <span class="small">{{ $t(`details.add.${a.key}Unit`) }}</span>
        </span>
        <p class="small muted">{{ $t(`details.add.${a.key}Note`, { min: n(minAir, 1), max: n(a.max(), 0) }) }}</p>
      </div>
    </fieldset>

    <fieldset>
      <legend>{{ $t('details.additionsTitle') }}</legend>
      <p class="small muted">{{ $t('details.additionsLead') }}</p>
      <div v-for="a in ADDITIONS" :key="a.key" class="addition" :class="{ off: !a.field.on.value }">
        <!-- Only the box itself toggles: a click beside the dose must not switch it off. -->
        <span class="check">
          <input v-model="a.field.on.value" type="checkbox" :aria-labelledby="`${id}-add-${a.key}`" />
          <strong :id="`${id}-add-${a.key}`">{{ $t(`details.add.${a.key}`) }}</strong>
        </span>
        <span class="amount">
          <NumberInput v-model="a.field.value.value" :max="a.max()" :digits="1" :disabled="!a.field.on.value" :aria-label="$t(`details.add.${a.key}Unit`)" />
          <span class="small">{{ $t(`details.add.${a.key}Unit`) }}</span>
        </span>
        <p class="small muted">{{ $t(`details.add.${a.key}Note`, { max: n(a.max(), 0) }) }}</p>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
// All inputs of the B 20 mix design. Changes apply at once; the page stores them in the URL.
import {
  ADDITION_SHARE, AGGREGATE_TYPES, CEMENT_TYPES, CEMENT_TYPE_NAMES, CONSISTENCY_CLASSES, DEFAULT_MOISTURE, PLASTICIZERS, SIEVE_LINES,
  SIEVE_LINE_NAMES, SILICA_FUME_MAX_FACTOR, STRENGTH_CLASSES, STRENGTH_CLASS_NAMES, minAirContent, strictestLimits,
  type ExposureClass, type MixInput,
} from '@cretelab/engine';
import { formatNumber, type Locale } from '~/utils/format';

const mix = defineModel<MixInput>('mix', { required: true });
const volume = defineModel<number>('volume', { required: true });
const id = useId();
const { locale } = useI18n();
const n = (v: number, d: number) => formatNumber(locale.value as Locale, v, d);

/** i18n keys cannot contain dots or slashes. */
const key = (value: string) => value.replace(/[./ ]/g, '_');

const EXPOSURE_GROUPS: { id: string; classes: ExposureClass[] }[] = [
  { id: 'none', classes: ['X0'] },
  { id: 'carbonation', classes: ['XC1', 'XC2', 'XC3', 'XC4'] },
  { id: 'chloride', classes: ['XD1', 'XD2', 'XD3'] },
  { id: 'seawater', classes: ['XS1', 'XS2', 'XS3'] },
  { id: 'frost', classes: ['XF1', 'XF2', 'XF3', 'XF4'] },
  { id: 'chemical', classes: ['XA1', 'XA2', 'XA3'] },
  { id: 'wear', classes: ['XM1', 'XM2', 'XM3'] },
];

// NumberInput works on number | null; the mix wants numbers.
const numberField = (get: () => number, set: (v: number) => void) =>
  computed<number | null>({ get, set: (v) => set(v ?? 0) });
const volumeField = numberField(() => volume.value, (v) => (volume.value = v));
const marginField = numberField(() => mix.value.margin, (v) => (mix.value.margin = v));

type PctKey = 'airPct' | 'flyAshPct' | 'silicaFumePct' | 'waterproofingPct';
/**
 * A substance that is either off (0) or dosed: the checkbox switches it, the box holds the
 * dose. Switching on starts with a typical dose, or the one entered before.
 */
function toggled(k: PctKey, typical: () => number) {
  const last = ref(mix.value[k] || 0);
  const on = computed({
    get: () => mix.value[k] > 0,
    set: (v: boolean) => (mix.value[k] = v ? last.value || typical() : 0),
  });
  const value = computed<number | null>({
    get: () => (mix.value[k] > 0 ? mix.value[k] : last.value || typical()),
    set: (v) => {
      if (!on.value) return;
      mix.value[k] = v ?? 0;
      if (v) last.value = v;
    },
  });
  return { on, value };
}

// Typical doses as in the bag tool (bagged/tuning.ts); air: the minimum for this grain.
const ADMIXTURES = [
  { key: 'air', field: toggled('airPct', () => minAir.value), max: () => 12 },
  { key: 'waterproofing', field: toggled('waterproofingPct', () => ADDITION_SHARE.waterproofing * 100), max: () => 5 },
];
const ADDITIONS = [
  // 10 %, not the bag tool's 15 %: fly ash adds fines, and 15 % tips many mixes over the limit.
  { key: 'flyAsh', field: toggled('flyAshPct', () => 10), max: () => Math.round(CEMENT_TYPES[mix.value.cementType].flyAshMaxFactor * 100) },
  { key: 'silicaFume', field: toggled('silicaFumePct', () => ADDITION_SHARE.silicaFume * 100), max: () => SILICA_FUME_MAX_FACTOR * 100 },
];

const lastPlasticizer = ref<'BV' | 'FM'>(mix.value.plasticizer === 'FM' ? 'FM' : 'BV');
const plasticizerOn = computed({
  get: () => mix.value.plasticizer !== 'none',
  set: (v: boolean) => (mix.value.plasticizer = v ? lastPlasticizer.value : 'none'),
});
const plasticizerKind = computed({
  get: () => (mix.value.plasticizer === 'none' ? lastPlasticizer.value : mix.value.plasticizer),
  set: (v: 'BV' | 'FM') => {
    lastPlasticizer.value = v;
    if (plasticizerOn.value) mix.value.plasticizer = v;
  },
});

// Switching moisture off and on again brings back the values entered before.
const lastMoisture = ref<[number, number, number]>(mix.value.moisture ? [...mix.value.moisture] : [...DEFAULT_MOISTURE]);
const useMoisture = computed({
  get: () => mix.value.moisture !== null,
  set: (on) => (mix.value.moisture = on ? [...lastMoisture.value] : null),
});
const moistureFields = [0, 1, 2].map((i) =>
  numberField(
    () => mix.value.moisture?.[i] ?? lastMoisture.value[i]!,
    (v) => {
      if (!mix.value.moisture) return;
      mix.value.moisture[i] = v;
      lastMoisture.value[i] = v;
    },
  ),
);

const minAir = computed(() => minAirContent(SIEVE_LINES[mix.value.sieveLine].maxGrain, mix.value.consistency));
const tooWeak = computed(() => {
  const need = strictestLimits(mix.value.exposureClasses, { airEntrained: mix.value.airPct >= minAir.value }).minFckCube;
  return STRENGTH_CLASSES[mix.value.strengthClass].fckCube < need ? need : 0;
});
</script>

<style scoped>
.form {
  display: grid;
  gap: 1.25rem;
}

fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem 1rem;
  display: grid;
  gap: 0.75rem;
}

legend {
  font-weight: 700;
  padding: 0 0.3rem;
}

.exposure-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  align-items: baseline;
}

.exposure-group > span {
  width: 100%;
}

.exposure {
  font-size: 0.9rem;
}

.addition {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) auto;
  gap: 0.25rem 1rem;
  align-items: center;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
}

.addition > p {
  grid-column: 1 / -1;
  margin: 0;
}

.addition .check,
.toggle {
  cursor: default;
  justify-self: start;
}

.addition .check input,
.toggle input {
  cursor: pointer;
}

.addition .amount {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.addition .amount :deep(input) {
  width: 5.5rem;
}

.addition.off .amount,
.addition.off select {
  opacity: 0.55;
}

@media (max-width: 40rem) {
  .addition {
    grid-template-columns: 1fr;
  }
}

.field.disabled label {
  color: var(--text-muted);
}

.warn-text {
  color: var(--warn);
}
</style>
