<template>
  <div class="app">
    <a class="skip" href="#main">{{ $t('nav.skip') }}</a>
    <AppHeader />
    <main id="main">
      <slot ></slot>
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
}

.skip {
  position: absolute;
  left: -999px;
}

.skip:focus {
  left: 1rem;
  top: 1rem;
  z-index: 10;
  background: var(--surface);
  padding: 0.5rem 1rem;
}
</style>
