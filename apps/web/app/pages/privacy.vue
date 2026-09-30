<template>
  <article class="page privacy">
    <h1>{{ $t('privacy.title') }}</h1>
    <p class="muted small">{{ $t('privacy.updated') }}</p>

    <h2>{{ $t('privacy.s1.title') }}</h2>
    <p>{{ $t('privacy.s1.text') }}</p>
    <OperatorAddress />
    <p v-if="configured">{{ $t('legal.email') }}: <a :href="`mailto:${legal.email}`">{{ legal.email }}</a></p>

    <section v-for="n in [2, 3, 4]" :key="n">
      <h2>{{ $t(`privacy.s${n}.title`) }}</h2>
      <p>{{ $t(`privacy.s${n}.text`) }}</p>
    </section>

    <h2>{{ $t('privacy.s5.title') }}</h2>
    <p>{{ $t('privacy.s5.text') }}</p>
    <ul>
      <li>{{ $t('privacy.s5.cookie') }}</li>
      <li>{{ $t('privacy.s5.session') }}</li>
    </ul>

    <h2>{{ $t('privacy.s6.title') }}</h2>
    <p data-testid="hosting">
      {{ legal.hosting ? $t('privacy.s6.provider', { hosting: legal.hosting }) : $t('privacy.s6.self') }}
    </p>

    <section v-for="n in [7, 8]" :key="n">
      <h2>{{ $t(`privacy.s${n}.title`) }}</h2>
      <p>{{ $t(`privacy.s${n}.text`) }}</p>
    </section>

    <p v-if="locale !== 'de'" class="small muted">{{ $t('privacy.bindingNote') }}</p>
  </article>
</template>

<script setup lang="ts">
// What this site actually does with data; keep it in step with nginx/default.conf,
// compose.yaml (log rotation) and useAnalysis.ts (session storage).
const { legal, configured } = useLegal();
const { t, locale } = useI18n();
useSeoMeta({ title: () => t('privacy.title'), robots: 'noindex' });
</script>

<style scoped>
.privacy {
  max-width: 44rem;
}

.privacy h2 {
  font-size: 1.1rem;
  margin-top: 1.5rem;
}
</style>
