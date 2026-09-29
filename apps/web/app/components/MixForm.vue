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
      <div class="field">
        <label :for="`${id}-plast`">{{ $t('details.plasticizer') }}</label>
        <select :id="`${id}-plast`" v-model="mix.plasticizer">
          <option v-for="p in PLASTICIZERS" :key="p" :value="p">{{ $t(`option.plasticizer.${p}`) }}</option>
        </select>
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
      <legend>{{ $t('details.additions') }}</legend>
      <div class="grid">
        <div class="field">
          <label :for="`${id}-air`">{{ $t('details.air') }}</label>
          <NumberInput :id="`${id}-air`" v-model="airField" :max="12" :digits="1" />
          <span class="hint">{{ $t('details.airHint', { min: n(minAir, 1) }) }}</span>
        </div>
        <div class="field">
          <label :for="`${id}-fa`">{{ $t('details.flyAsh') }}</label>
          <NumberInput :id="`${id}-fa`" v-model="flyAshField" :max="33" :digits="1" />
        </div>
        <div class="field">
          <label :for="`${id}-sf`">{{ $t('details.silicaFume') }}</label>
          <NumberInput :id="`${id}-sf`" v-model="silicaField" :max="11" :digits="1" />
        </div>
        <div class="field">
          <label :for="`${id}-wu`">{{ $t('details.waterproofing') }}</label>
          <NumberInput :id="`${id}-wu`" v-model="wuField" :max="5" :digits="1" />
        </div>
      </div>
      <label class="check">
        <input v-model="useMoisture" type="checkbox" />
        <span>{{ $t('details.moisture') }}</span>
      </label>
      <div v-if="mix.moisture" class="grid">
        <div v-for="(label, i) in ['0/2', '2/8', '8+']" :key="label" class="field">
          <label :for="`${id}-mo${i}`">{{ $t('details.moistureGroup', { group: label }) }}</label>
          <NumberInput :id="`${id}-mo${i}`" v-model="moistureFields[i]!.value" :max="20" :digits="1" />
        </div>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
// All inputs of the B 20 mix design. Changes apply at once; the page stores them in the URL.
import {
  AGGREGATE_TYPES, CEMENT_TYPE_NAMES, CONSISTENCY_CLASSES, DEFAULT_MOISTURE, PLASTICIZERS, SIEVE_LINES,
  SIEVE_LINE_NAMES, STRENGTH_CLASSES, STRENGTH_CLASS_NAMES, minAirContent, strictestLimits,
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
const airField = numberField(() => mix.value.airPct, (v) => (mix.value.airPct = v));
const flyAshField = numberField(() => mix.value.flyAshPct, (v) => (mix.value.flyAshPct = v));
const silicaField = numberField(() => mix.value.silicaFumePct, (v) => (mix.value.silicaFumePct = v));
const wuField = numberField(() => mix.value.waterproofingPct, (v) => (mix.value.waterproofingPct = v));

const useMoisture = computed({
  get: () => mix.value.moisture !== null,
  set: (on) => (mix.value.moisture = on ? [...DEFAULT_MOISTURE] : null),
});
const moistureFields = [0, 1, 2].map((i) =>
  numberField(
    () => mix.value.moisture?.[i] ?? 0,
    (v) => {
      if (mix.value.moisture) mix.value.moisture[i] = v;
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

.warn-text {
  color: var(--warn);
}
</style>
