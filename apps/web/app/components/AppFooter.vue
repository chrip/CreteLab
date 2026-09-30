<template>
  <footer class="footer">
    <div class="inner small muted">
      <p>
        <a :href="repository" rel="noopener">GitHub</a> · MIT ·
        <NuxtLinkLocale to="/about">{{ $t('nav.about') }}</NuxtLinkLocale> ·
        <NuxtLinkLocale to="/legal">{{ $t('footer.legal') }}</NuxtLinkLocale> ·
        <NuxtLinkLocale to="/privacy">{{ $t('footer.privacy') }}</NuxtLinkLocale>
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
const { repository } = useRuntimeConfig().public;
</script>

<style scoped>
.footer {
  border-top: 1px solid var(--border);
  margin-top: 3rem;
}

.inner {
  width: min(100% - 2rem, var(--page));
  margin-inline: auto;
  padding-block: 1.5rem;
}
</style>
