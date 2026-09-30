<template>
  <NuxtLayout>
    <div class="page">
      <h1>{{ notFound ? $t('error.notFoundTitle') : $t('error.title') }}</h1>
      <p class="lead">{{ notFound ? $t('error.notFound') : $t('error.text') }}</p>
      <NuxtLinkLocale to="/" class="btn">{{ $t('error.home') }}</NuxtLinkLocale>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
// The page for unknown addresses and unexpected errors, in the layout of the site.
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
const notFound = computed(() => props.error.statusCode === 404);
const { t } = useI18n();
useSeoMeta({ title: () => (notFound.value ? t('error.notFoundTitle') : t('error.title')), robots: 'noindex' });
</script>
