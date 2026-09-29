<template>
  <div class="page">
    <h1>{{ $t('bagTool.title') }}</h1>
    <p class="lead">{{ $t('bagTool.lead') }}</p>
    <!-- The state comes from the URL, which a static page does not know at build time. -->
    <ClientOnly>
      <BagToolApp />
      <template #fallback>
        <p class="muted">{{ $t('common.loading') }}</p>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
useSeoMeta({ title: () => t('bagTool.title'), description: () => t('bagTool.lead') });
</script>
