<template>
  <input
    :id="id"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    :value="text"
    :aria-invalid="invalid || undefined"
    @input="onInput"
    @blur="text = display(model)"
  />
</template>

<script setup lang="ts">
// A decimal field that accepts "2,5" and "2.5" and shows the number the local way.
import { formatCompact, parseDecimal, type Locale } from '~/utils/format';

const props = withDefaults(defineProps<{ id?: string; min?: number; max?: number; digits?: number; optional?: boolean }>(), {
  id: undefined,
  min: 0,
  max: Infinity,
  digits: 3,
  optional: false,
});
const model = defineModel<number | null>({ required: true });
const { locale } = useI18n();

const display = (v: number | null) => (v === null ? '' : formatCompact(locale.value as Locale, v, props.digits));
const text = ref(display(model.value));
const invalid = ref(false);

watch(model, (v) => {
  if (parseDecimal(text.value) !== v) text.value = display(v);
});
watch(locale, () => (text.value = display(model.value)));

function onInput(e: Event) {
  text.value = (e.target as HTMLInputElement).value;
  if (props.optional && text.value.trim() === '') {
    invalid.value = false;
    model.value = null;
    return;
  }
  const n = parseDecimal(text.value);
  invalid.value = !(n >= props.min && n <= props.max);
  if (!invalid.value) model.value = n;
}
</script>

<style scoped>
input[aria-invalid] {
  border-color: var(--danger);
}
</style>
