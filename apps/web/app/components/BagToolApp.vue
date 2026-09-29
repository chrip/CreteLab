<template>
  <div class="stack">
    <p class="note warn" role="note">
      <strong>{{ $t('bagTool.warningTitle') }}</strong> {{ $t('bagTool.warning') }}
    </p>

    <section class="card stack" aria-labelledby="base-title">
      <h2 id="base-title">{{ $t('bagTool.base') }}</h2>
      <div class="grid">
        <div class="field">
          <label :for="`${id}-mix`">{{ $t('bagTool.mix') }}</label>
          <select :id="`${id}-mix`" v-model="state.mix">
            <option v-for="m in BAG_MIXES" :key="m.id" :value="m.id">{{ $t('bagTool.mixOption', { strength: m.strengthClass }) }}</option>
          </select>
          <span class="hint">{{ $t('bagTool.mixHint') }}</span>
        </div>
        <div class="field">
          <label :for="`${id}-volume`">{{ $t('bagTool.volume') }}</label>
          <NumberInput :id="`${id}-volume`" v-model="volumeField" :min="0.001" :max="100" :digits="3" />
          <span class="hint">= {{ litres(state.volume) }}</span>
        </div>
      </div>
    </section>

    <section class="card" aria-labelledby="options-title">
      <h2 id="options-title">{{ $t('bagTool.options') }}</h2>
      <div class="options">
        <label v-for="o in TOGGLES" :key="o" class="check option">
          <input v-model="state.options[o]" type="checkbox" />
          <span>
            <strong>{{ $t(`bagTool.option.${o}.name`) }}</strong>
            <span class="small muted">{{ $t(`bagTool.option.${o}.effect`) }}</span>
          </span>
        </label>
        <div class="field">
          <label :for="`${id}-plast`">{{ $t('details.plasticizer') }}</label>
          <select :id="`${id}-plast`" v-model="state.options.plasticizer">
            <option v-for="p in PLASTICIZERS" :key="p" :value="p">{{ $t(`option.plasticizer.${p}`) }}</option>
          </select>
        </div>
      </div>
      <p v-if="tuned.airWithSilicaFume" class="note warn">{{ $t('bagTool.airWithSilica') }}</p>
    </section>

    <section class="card stack" aria-labelledby="result-title">
      <h2 id="result-title">{{ $t('bagTool.result') }}</h2>
      <div class="compare" aria-live="polite" data-testid="strength-compare">
        <div class="tile">
          <span class="label">{{ $t('bagTool.baseLabel') }}</span>
          <strong class="class">{{ mix.strengthClass }}</strong>
          <span>{{ $t('bagTool.strengthValue', { fck: tuned.baseFckCube }) }}</span>
        </div>
        <div class="arrow" aria-hidden="true">
          <span>→</span>
          <span v-if="delta !== 0" class="delta" :class="delta > 0 ? 'up' : 'down'">{{ deltaText }}</span>
        </div>
        <div class="tile result">
          <span class="label">{{ $t(delta === 0 && !hasAdditions ? 'bagTool.noAdditions' : 'bagTool.resultLabel') }}</span>
          <strong class="class">{{ tuned.strengthClass }}</strong>
          <span>{{ $t('bagTool.strengthValue', { fck: tuned.fckCube }) }}</span>
        </div>
      </div>
      <p class="small muted">{{ $t('bagTool.estimateNote') }}</p>
      <ol class="steps">
        <li v-for="(step, i) in tuned.steps" :key="i">{{ stepText(step) }}</li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
// What additions do to a bag mix. Estimates only: manufacturers forbid additions (R4).
import { BAG_KG, BAG_MIXES, PLASTICIZERS, bagMix, tuneBag, type BagStep } from '@cretelab/engine';
import { formatAmount, formatNumber, type Locale } from '~/utils/format';
import { decodeBagTool, encodeBagTool } from '~/utils/query';

const TOGGLES = ['extraCement', 'flyAsh', 'silicaFume', 'air', 'waterproofing'] as const;

const { state } = useUrlState(decodeBagTool, encodeBagTool);
const id = useId();
const { t, locale } = useI18n();
const loc = computed(() => locale.value as Locale);
const litres = (m3: number) => `${formatNumber(loc.value, m3 * 1000, m3 < 0.01 ? 1 : 0)} l`;
const amount = (v: number, unit: 'kg' | 'l') => formatAmount(loc.value, v, unit);

const volumeField = computed<number | null>({
  get: () => state.value.volume,
  set: (v) => (state.value.volume = v ?? 0.1),
});
const mix = computed(() => bagMix(state.value.mix) ?? BAG_MIXES[1]!);
const tuned = computed(() => tuneBag(mix.value, state.value.volume, state.value.options));
const delta = computed(() => tuned.value.fckCube - tuned.value.baseFckCube);
const deltaText = computed(() => `${delta.value > 0 ? '+' : '−'}${Math.abs(delta.value)} N/mm²`);
const hasAdditions = computed(() => {
  const o = state.value.options;
  return o.extraCement || o.flyAsh || o.silicaFume || o.air || o.waterproofing || o.plasticizer !== 'none';
});

function stepText(step: BagStep): string {
  switch (step.kind) {
    case 'mix':
      return t('bagTool.step.mix', {
        amount: amount(step.kg, 'kg'),
        strength: step.strengthClass,
        bags: formatNumber(loc.value, step.bags, step.bags < 10 ? 1 : 0),
        bag: BAG_KG,
      });
    case 'plasticizer':
      return t('bagTool.step.plasticizer', { amount: amount(step.litres, 'l'), name: t(`option.plasticizer.${step.type}`) });
    case 'air':
      return t('bagTool.step.air', { amount: amount(step.litres, 'l') });
    case 'water':
      return t(step.withAdmixtures ? 'bagTool.step.waterWith' : 'bagTool.step.water', { amount: amount(step.litres, 'l') });
    default:
      return t(`bagTool.step.${step.kind}`, { amount: amount(step.kg, 'kg') });
  }
}
</script>

<style scoped>
.options {
  display: grid;
  gap: 0.75rem;
}

.option > span {
  display: flex;
  flex-direction: column;
}

.compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  background: var(--surface-2);
}

.tile.result {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.class {
  font-size: 1.75rem;
  line-height: 1.1;
}

.arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 1.5rem;
  color: var(--text-muted);
}

.delta {
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
  white-space: nowrap;
}

.delta.up {
  color: var(--ok);
  background: var(--ok-soft);
}

.delta.down {
  color: var(--danger);
  background: var(--danger-soft);
}

@media (max-width: 40rem) {
  .compare {
    grid-template-columns: 1fr;
  }

  .arrow {
    flex-direction: row;
    justify-content: center;
    gap: 0.5rem;
    transform: none;
  }

  .arrow > span:first-child {
    transform: rotate(90deg);
  }
}
</style>
