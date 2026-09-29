<template>
  <div class="stack">
    <p class="note" :class="{ warn: spec.belowTypicalMinimum }">
      {{ spec.belowTypicalMinimum ? $t('order.small', { volume: vol(volume) }) : $t('order.lead') }}
    </p>

    <div>
      <h3>{{ $t('order.textTitle') }}</h3>
      <pre class="order" data-testid="order-text">{{ text }}</pre>
    </div>

    <dl class="spec">
      <div><dt>{{ $t('order.strength') }}</dt><dd>{{ spec.strengthClass }}</dd></div>
      <div><dt>{{ $t('order.exposure') }}</dt><dd>{{ spec.exposureClasses.join(', ') || 'X0' }}</dd></div>
      <div><dt>{{ $t('order.moisture') }}</dt><dd>{{ spec.moistureClass }} – {{ $t(`order.moistureClass.${spec.moistureClass}`) }}</dd></div>
      <div><dt>{{ $t('order.consistency') }}</dt><dd>{{ spec.consistency }}</dd></div>
      <div><dt>{{ $t('order.grain') }}</dt><dd>{{ spec.maxGrain }} mm</dd></div>
      <div><dt>{{ $t('order.chloride') }}</dt><dd>{{ spec.chlorideClass }}</dd></div>
    </dl>

    <ul class="small muted tips">
      <li>{{ $t('order.tip.volume', { volume: vol(spec.orderVolume) }) }}</li>
      <li>{{ $t('order.tip.surcharge') }}</li>
      <li>{{ $t('order.tip.station') }}</li>
      <li>{{ $t('order.tip.noWater') }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// Ordering ready-mixed concrete: the specification a plant needs (DIN EN 206 / DIN 1045-2).
import { orderLine, orderSpec, type MixInput } from '@cretelab/engine';
import { formatNumber, formatVolume, type Locale } from '~/utils/format';
import { heavyTraffic, isReinforced } from '~/utils/mix';

const props = defineProps<{ mix: MixInput; volume: number }>();
const { t, locale } = useI18n();
const vol = (v: number) => formatVolume(locale.value as Locale, v);

const spec = computed(() =>
  orderSpec(props.mix, props.volume, {
    reinforced: isReinforced(props.mix.exposureClasses),
    heavyTraffic: heavyTraffic(props.mix.exposureClasses),
  }),
);

const text = computed(() => {
  const s = spec.value;
  const lines = [
    t('order.text.concrete', { line: orderLine(s) }),
    t('order.text.volume', { volume: formatNumber(locale.value as Locale, s.orderVolume, 1) }),
  ];
  if (s.airPct !== null) lines.push(t('order.text.air', { pct: formatNumber(locale.value as Locale, s.airPct, 1) }));
  if (s.watertight) lines.push(t('order.text.watertight'));
  lines.push(t('order.text.delivery'));
  return lines.join('\n');
});

</script>

<style scoped>
.order {
  font-family: var(--mono);
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 1rem;
  white-space: pre-wrap;
  margin: 0;
}

.spec {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem 1.5rem;
}

dt {
  font-size: 0.8rem;
  color: var(--text-muted);
}

dd {
  margin: 0;
}

.tips {
  padding-left: 1.2rem;
}
</style>
