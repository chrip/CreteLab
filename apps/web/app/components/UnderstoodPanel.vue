<template>
  <section class="card understood" aria-labelledby="understood-title">
    <h2 id="understood-title">{{ $t('facts.title') }}</h2>

    <h3>{{ $t('facts.properties') }}</h3>
    <ul class="tags">
      <li v-for="f in facts" :key="f.id" class="chip" :class="f.level" :title="`${Math.round(f.p * 100)} %`">
        {{ $t(`facts.${f.id}`) }}<span v-if="f.level === 'unsure'" class="muted"> · {{ $t('facts.unsure') }}</span>
      </li>
      <li class="chip yes">{{ $t(`facts.element.${element}`) }}</li>
      <li class="chip yes">{{ $t(`facts.traffic.${traffic}`) }}</li>
    </ul>

    <h3>{{ $t('facts.amount') }}</h3>
    <ul class="tags" data-testid="understood-volume">
      <li v-if="plan.volume.source === 'default'" class="chip missing">
        {{ $t('facts.noSize', { volume: vol(plan.volume.volume) }) }}
      </li>
      <template v-else>
        <li v-if="plan.volume.shape" class="chip yes">{{ $t('facts.shape', { shape: $t(`volume.shape.${plan.volume.shape}`) }) }}</li>
        <li v-if="plan.volume.shape === 'hollow'" class="chip yes">{{ $t(`volume.open.${plan.volume.open ?? 'one'}`) }}</li>
      </template>
      <!-- Shown even without a volume: they explain why none could be calculated. -->
      <li v-for="m in measurements" :key="m.candidate" class="chip" :class="m.used ? 'yes' : 'no'">
        <strong>{{ m.label }}</strong> {{ m.role }}
      </li>
    </ul>
    <p v-if="formula" class="formula" data-testid="volume-formula">{{ formula }}</p>
    <p v-else-if="plan.volume.source === 'volume'" class="formula">{{ $t('facts.given', { volume: vol(plan.volume.volume) }) }}</p>
    <p v-if="edited" class="small muted">{{ $t('facts.edited', { volume: vol(volume) }) }}</p>
  </section>
</template>

<script setup lang="ts">
// What the model read from the description: the exposure facts with their certainty and
// the measurements with the role each one plays in the volume, plus the calculation.
import { FACT_IDS, certainty, parseCandidate, probability, type AnalysisResponse, type ProjectPlan } from '@cretelab/engine';
import { formatBreakdown, formatVolume, type Locale } from '~/utils/format';

const props = defineProps<{ analysis: AnalysisResponse; plan: ProjectPlan; volume: number }>();
const { t, locale } = useI18n();
const vol = (v: number) => formatVolume(locale.value as Locale, v);

const facts = computed(() =>
  ['fine_cast', ...FACT_IDS].map((id) => {
    const p = probability(props.analysis.answers, id);
    return { id, p, level: certainty(p) };
  }),
);
const element = computed(() => props.analysis.answers.element?.choice ?? 'slab');
const traffic = computed(() => Math.round(props.analysis.answers.traffic?.score ?? 0));

const ROLES = ['length', 'width', 'height', 'diameter', 'wall', 'thickness', 'area', 'volume', 'count'];

/** Every measurement in the text with the role Laya gave it; "3x2 m" explains itself. */
const measurements = computed(() =>
  props.analysis.candidates.map((candidate) => {
    const label = candidate.replace(/ #\d+$/, '');
    const parsed = parseCandidate(candidate);
    if (parsed?.kind === 'dims') {
      return { candidate, label, used: true, role: t(parsed.size.length === 3 ? 'facts.dims3' : 'facts.dims2') };
    }
    const role = props.analysis.answers[`role:${candidate}`]?.choice;
    const used = Boolean(role && ROLES.includes(role));
    return { candidate, label, used, role: used ? t(`facts.role.${role}`) : t('facts.unused') };
  }),
);

const formula = computed(() => (props.plan.volume.breakdown ? formatBreakdown(locale.value as Locale, props.plan.volume.breakdown) : ''));
const edited = computed(() => Math.abs(props.plan.volume.volume - props.volume) > 1e-9);
</script>

<style scoped>
h3 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 1rem 0 0.4rem;
}

.tags {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip.missing {
  background: var(--warn-soft);
  border: 1px solid var(--warn);
}

.formula {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin: 0.75rem 0 0;
  overflow-wrap: anywhere;
}
</style>
