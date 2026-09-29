<template>
  <header class="header">
    <div class="inner">
      <NuxtLinkLocale to="/" class="brand">
        <img src="/icon.png" alt="" width="32" height="32" />
        <span>CreteLab</span>
      </NuxtLinkLocale>
      <nav :aria-label="$t('nav.label')">
        <NuxtLinkLocale to="/plan">{{ $t('nav.planner') }}</NuxtLinkLocale>
        <NuxtLinkLocale to="/fine-concrete">{{ $t('nav.fineConcrete') }}</NuxtLinkLocale>
        <NuxtLinkLocale to="/bag">{{ $t('nav.bag') }}</NuxtLinkLocale>
        <NuxtLinkLocale to="/about">{{ $t('nav.about') }}</NuxtLinkLocale>
      </nav>
      <NuxtLink
        class="lang"
        :to="switchLocalePath(otherLocale)"
        :hreflang="otherLocale"
        :aria-label="$t('nav.language')"
      >
        {{ otherLocale.toUpperCase() }}
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
const { locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const otherLocale = computed(() => (locale.value === 'de' ? 'en' : 'de'));
</script>

<style scoped>
.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.inner {
  width: min(100% - 2rem, var(--page));
  margin-inline: auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-block: 0.75rem;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--text);
  text-decoration: none;
}

nav {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  flex: 1;
}

nav a {
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 500;
}

nav a:hover,
nav a.router-link-active {
  color: var(--text);
}

nav a.router-link-active {
  box-shadow: 0 2px 0 var(--accent);
}

@media (max-width: 40rem) {
  .inner {
    gap: 0.5rem 1rem;
  }

  nav {
    order: 3;
    flex: 1 0 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    white-space: nowrap;
    padding-bottom: 0.25rem;
  }

  .lang {
    margin-left: auto;
  }
}

.lang {
  font-weight: 700;
  text-decoration: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.15rem 0.7rem;
  color: var(--text);
}
</style>
