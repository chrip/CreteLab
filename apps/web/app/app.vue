<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const head = useLocaleHead();
useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs?.lang },
  link: head.value.link,
  meta: head.value.meta,
  titleTemplate: (title?: string) => (title ? `${title} · CreteLab` : 'CreteLab'),
}));
</script>
