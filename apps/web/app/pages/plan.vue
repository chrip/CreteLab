<template>
  <div class="page">
    <h1>{{ $t('planner.title') }}</h1>
    <p class="lead">{{ $t('planner.lead') }}</p>
    <!-- The state comes from the URL, which a static page does not know at build time. -->
    <ClientOnly>
      <PlannerApp />
      <template #fallback>
        <p class="muted">{{ $t('common.loading') }}</p>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
useSeoMeta({ title: () => t('planner.title'), description: () => t('planner.lead') });
</script>
