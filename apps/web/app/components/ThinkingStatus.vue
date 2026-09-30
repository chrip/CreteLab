<template>
  <p class="thinking" data-testid="thinking">
    <span class="star" aria-hidden="true">{{ STARS[frame % STARS.length] }}</span>
    <span class="typed" aria-hidden="true">{{ shown }}<span class="cursor"></span></span>
    <!-- Screen readers get each step once, not every letter. -->
    <span class="visually-hidden" aria-live="polite">{{ step }}</span>
  </p>
</template>

<script setup lang="ts">
// While Laya works: the steps it goes through are typed in, held, deleted from the end and
// replaced by the next one. The last step stays until the answer is there.
const STEPS = 6;
const STARS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const TYPE_MS = 32;
const DELETE_MS = 14;
const HOLD_MS = 700;

const { t } = useI18n();
const index = ref(0);
const shown = ref('');
const frame = ref(0);
const step = computed(() => t(`describe.steps.${index.value + 1}`));

let timer: ReturnType<typeof setTimeout> | undefined;
let spinner: ReturnType<typeof setInterval> | undefined;

function later(ms: number, next: () => void) {
  timer = setTimeout(next, ms);
}

function type() {
  const full = step.value;
  if (shown.value.length < full.length) {
    shown.value = full.slice(0, shown.value.length + 1);
    return later(TYPE_MS, type);
  }
  if (index.value < STEPS - 1) later(HOLD_MS, erase);
}

function erase() {
  if (shown.value.length > 0) {
    shown.value = shown.value.slice(0, -1);
    return later(DELETE_MS, erase);
  }
  index.value++;
  type();
}

onMounted(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    // No typing: whole steps, one after the other.
    shown.value = step.value;
    const next = () => {
      if (index.value >= STEPS - 1) return;
      index.value++;
      shown.value = step.value;
      later(1500, next);
    };
    return later(1500, next);
  }
  spinner = setInterval(() => frame.value++, 120);
  type();
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  clearInterval(spinner);
});
</script>

<style scoped>
.thinking {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  margin: 0.75rem 0 0;
  color: var(--text-muted);
  min-height: 1.5em;
}

.star {
  color: var(--accent);
  width: 1ch;
  text-align: center;
}

.cursor {
  display: inline-block;
  width: 0.5ch;
  height: 1.1em;
  margin-left: 1px;
  vertical-align: text-bottom;
  background: currentColor;
  animation: blink 1s steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cursor {
    animation: none;
  }
}
</style>
