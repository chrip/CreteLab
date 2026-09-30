<template>
  <address v-if="configured" data-testid="operator">
    {{ legal.name }}<br />
    {{ legal.street }}<br />
    {{ legal.city }}<template v-if="legal.country"><br />{{ legal.country }}</template>
  </address>
  <p v-else class="note warn" data-testid="operator-missing">{{ $t('legal.missing') }}</p>
</template>

<script setup lang="ts">
const { legal, configured } = useLegal();
</script>

<style scoped>
address {
  font-style: normal;
  margin-bottom: 1rem;
}
</style>
