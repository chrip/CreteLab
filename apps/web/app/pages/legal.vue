<template>
  <article class="page legal">
    <h1>{{ $t('legal.title') }}</h1>
    <p class="muted">{{ $t('legal.lead') }}</p>
    <OperatorAddress />
    <p v-if="configured && legal.email">
      {{ $t('legal.email') }}: <a :href="`mailto:${legal.email}`">{{ legal.email }}</a>
    </p>
    <p v-if="locale !== 'de'" class="small muted">{{ $t('legal.bindingNote') }}</p>
  </article>
</template>

<script setup lang="ts">
// The minimum for a non-commercial site: name and address (§ 18 (1) MStV). An email address
// is shown when LEGAL_EMAIL is set (§ 5 DDG asks for one from commercial services).
const { legal, configured } = useLegal();
const { t, locale } = useI18n();
useSeoMeta({ title: () => t('legal.title'), robots: 'noindex' });
</script>

<style scoped>
.legal {
  max-width: 44rem;
}
</style>
