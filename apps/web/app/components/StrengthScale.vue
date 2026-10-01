<template>
  <figure class="scale" data-testid="strength-scale">
    <div class="track" role="img" :aria-label="ariaLabel">
      <div
        v-for="(step, i) in STEPS"
        :key="step"
        class="step"
        :class="{ marked: marked.has(i), dark: i >= 6, last: i === STEPS.length - 1 }"
        :style="{ background: shade(i) }"
        aria-hidden="true"
      >
        {{ step }}
      </div>
      <div
        v-for="m in pointers"
        :key="m.kind"
        class="pointer"
        :class="m.kind"
        :style="{ left: `${((m.index + 0.5) / STEPS.length) * 100}%` }"
        aria-hidden="true"
      ></div>
    </div>
    <div class="ends small muted" aria-hidden="true">
      <span>{{ $t('needs.strengthWord.C8_10') }}</span>
      <span>{{ $t('needs.strengthWord.C70_85') }}</span>
    </div>
    <figcaption>
      <span v-for="m in captions" :key="m.kind" class="entry">
        <span v-if="m.label" :class="['key', m.kind]">{{ m.label }}: </span>
        <strong>{{ m.cls }}</strong> {{ word(m.cls) }}<span v-if="m.kind === 'main'" class="muted"> · {{ use(m.cls) }}</span>
      </span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
// How strong a class is, at a glance: the classes as steps from light to dark like an
// energy label, a pointer on the class, its word and what it is typically used for.
// Weak is not bad here, only for other jobs, so the steps go light to dark, not red to green.
import { STRENGTH_CLASSES, type StrengthClass } from '@cretelab/engine';

interface ScaleMark {
  cls: StrengthClass;
  /** 'main' is the class shown; 'from' a starting point (the bag before additions). */
  kind: 'main' | 'from';
  label?: string;
}

const props = defineProps<{ marks: ScaleMark[] }>();
const { t } = useI18n();

/** Steps by cylinder strength; everything from C55/67 up is one step. */
const STEPS = ['8', '12', '16', '20', '25', '30', '35', '40', '45', '50', '55+'] as const;
const indexOf = (cls: StrengthClass) => {
  const i = STEPS.indexOf(String(STRENGTH_CLASSES[cls].fckCyl) as (typeof STEPS)[number]);
  return i < 0 ? STEPS.length - 1 : i;
};
// Light steps carry dark text, dark ones white; the middle tones have enough contrast for
// neither, so the ramp jumps there (WCAG AA for the small step numbers).
const SHADES = [10, 17, 24, 31, 38, 45, 82, 86, 90, 95, 100];
const shade = (i: number) => `color-mix(in srgb, var(--accent) ${SHADES[i]}%, var(--surface))`;
const key = (cls: StrengthClass) => cls.replace('/', '_');
const word = (cls: StrengthClass) => t(`needs.strengthWord.${key(cls)}`);
const use = (cls: StrengthClass) => t(`option.strength.${key(cls)}`);

const pointers = computed(() => {
  const list = props.marks.map((m) => ({ ...m, index: indexOf(m.cls) }));
  // One pointer when both marks sit on the same step.
  return list.filter((m, i) => list.findIndex((o) => o.index === m.index) === i);
});
const marked = computed(() => new Set(pointers.value.map((p) => p.index)));
const captions = computed(() => {
  const order = [...props.marks].sort((a) => (a.kind === 'from' ? -1 : 1));
  return order.filter((m, i) => order.findIndex((o) => o.cls === m.cls) === i);
});
const ariaLabel = computed(() =>
  captions.value.map((m) => `${m.label ? `${m.label}: ` : ''}${m.cls}, ${word(m.cls)}`).join('; ') +
  ` (${t('needs.scaleRange', { from: word('C8/10'), to: word('C70/85') })})`,
);
</script>

<style scoped>
.scale {
  margin: 1.25rem 0 1.25rem;
  padding-top: 1rem; /* room for the pointer, inside the figure */
}

.track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(11, minmax(0, 1fr));
  gap: 2px;
}

.step {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.45rem 0;
  color: var(--text);
}

.step:first-child {
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.step.last {
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* The page background as text colour: white in light mode, near black in dark mode, where
   the accent is light. */
.step.dark {
  color: var(--surface);
}

.step.marked {
  outline: 2px solid var(--text);
  outline-offset: 1px;
  position: relative;
  z-index: 1;
}

.pointer {
  position: absolute;
  top: -0.9rem;
  width: 0;
  height: 0;
  transform: translateX(-50%);
  border-left: 0.7rem solid transparent;
  border-right: 0.7rem solid transparent;
  border-top: 0.8rem solid var(--text);
}

.pointer.from {
  border-top-color: var(--text-muted);
}


.ends {
  display: flex;
  justify-content: space-between;
  margin-top: 0.4rem;
}

figcaption {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.3rem;
}

/* The caption names the pointers: grey for the starting point, dark for the result. */
.key::before {
  content: '';
  display: inline-block;
  margin-right: 0.3rem;
  /* The scale's pointer turned to the right, towards its label: no disclosure arrow. */
  border-top: 0.45rem solid transparent;
  border-bottom: 0.45rem solid transparent;
  border-left: 0.55rem solid var(--text);
}

.key.from::before {
  border-left-color: var(--text-muted);
}
</style>
