<template>
  <form class="describe" @submit.prevent="submit">
    <label :for="id" class="visually-hidden">{{ $t('describe.label') }}</label>
    <div class="box">
      <textarea
        :id="id"
        v-model="text"
        rows="3"
        :aria-describedby="error ? `${id}-error` : undefined"
        @keydown.enter.exact.prevent="submit"
      ></textarea>
      <button class="btn" type="submit" :disabled="busy || !text.trim()">
        {{ busy ? $t('describe.busy') : $t(submitLabel) }}
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="note blocker" role="alert">
      {{ $t('describe.error', { reason: error }) }}
    </p>
    <div v-if="examples && !submitted" class="examples small muted">
      <span>{{ $t('describe.examples') }}</span>
      <button v-for="n in 4" :key="n" type="button" class="example" @click="pick($t(`describe.example${n}`))">
        {{ $t(`describe.example${n}`) }}
      </button>
    </div>
    <p class="small muted hint">{{ $t('describe.enterHint') }}</p>
  </form>
</template>

<script setup lang="ts">
// The one text box: Enter analyses, Shift+Enter starts a new line.
const props = withDefaults(
  defineProps<{ initial?: string; busy?: boolean; error?: string | null; examples?: boolean; submitLabel?: string }>(),
  { initial: '', busy: false, error: null, examples: false, submitLabel: 'describe.submit' },
);
const emit = defineEmits<{ submit: [text: string] }>();
const id = useId();
const text = ref(props.initial);
const submitted = ref(Boolean(props.initial));

watch(() => props.initial, (v) => (text.value = v));
// Emptying the box brings the examples back.
watch(text, (v) => {
  if (!v.trim()) submitted.value = false;
});

function submit() {
  const value = text.value.trim();
  if (!value || props.busy) return;
  submitted.value = true;
  emit('submit', value);
}

function pick(example: string) {
  text.value = example;
  submit();
}
</script>

<style scoped>
.box {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

textarea {
  flex: 1;
  resize: vertical;
  padding: 0.85rem 1.1rem;
  font-size: 1.05rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  min-height: 5.5rem;
}

.examples {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-top: 0.75rem;
}

.example {
  font: inherit;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 0.2rem 0.75rem;
  cursor: pointer;
}

.hint {
  margin-top: 0.4rem;
}

@media (max-width: 40rem) {
  .box {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
