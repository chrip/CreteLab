<template>
  <div class="page">
    <h1>{{ $t('decor.title') }}</h1>
    <p class="lead">{{ $t('decor.lead') }}</p>
    <!-- The state comes from the URL, which a static page does not know at build time. -->
    <ClientOnly>
      <DecorApp />
      <template #fallback>
        <p class="muted">{{ $t('common.loading') }}</p>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
useSeoMeta({ title: () => t('decor.title'), description: () => t('decor.lead') });
</script>
