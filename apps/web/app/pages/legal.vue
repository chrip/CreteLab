<template>
  <article class="page legal">
    <h1>{{ $t('legal.title') }}</h1>
    <p class="muted">{{ $t('legal.lead') }}</p>
    <OperatorAddress />
    <template v-if="configured">
      <h2>{{ $t('legal.contact') }}</h2>
      <p>
        {{ $t('legal.email') }}: <a :href="`mailto:${legal.email}`">{{ legal.email }}</a>
        <template v-if="legal.phone"><br />{{ $t('legal.phone') }}: {{ legal.phone }}</template>
      </p>
      <h2>{{ $t('legal.responsible') }}</h2>
      <p>{{ legal.name }}, {{ $t('legal.sameAsAbove') }}</p>
    </template>
    <p>{{ $t('legal.project') }}</p>
    <p v-if="locale !== 'de'" class="small muted">{{ $t('legal.bindingNote') }}</p>
  </article>
</template>

<script setup lang="ts">
const { legal, configured } = useLegal();
const { t, locale } = useI18n();
useSeoMeta({ title: () => t('legal.title'), robots: 'noindex' });
</script>

<style scoped>
.legal {
  max-width: 44rem;
}

.legal h2 {
  font-size: 1.1rem;
  margin-top: 1.5rem;
}
</style>
