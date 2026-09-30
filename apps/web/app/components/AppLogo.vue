<template>
  <!-- A concrete mixer in a rounded badge: drum with its ring band and opening, two legs. -->
  <svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect class="badge" width="32" height="32" rx="8" />
    <mask :id="mask">
      <rect width="32" height="32" fill="#fff" />
      <ellipse cx="21.7" cy="9.3" rx="4" ry="1.15" transform="rotate(45 21.7 9.3)" fill="#000" />
      <path d="M22.83 25.14 L5.86 8.17" stroke="#000" stroke-width="1.2" />
    </mask>
    <g class="mixer" transform="translate(16 16) scale(.74) translate(-14.5 -18.5)">
      <g :mask="`url(#${mask})`">
        <circle cx="13.5" cy="17.5" r="8.6" />
        <path d="M20.78 21.25 L25.36 13.56 L17.44 5.64 L9.75 10.22 Z" />
        <ellipse cx="21.4" cy="9.6" rx="5.6" ry="2.2" transform="rotate(45 21.4 9.6)" />
      </g>
      <path class="legs" d="M9.5 24 L7 30 M18 24.5 L20.5 30" />
    </g>
  </svg>
</template>

<script setup lang="ts">
// Mask ids must be unique on the page.
const mask = `logo-${useId()}`;
</script>

<style scoped>
.logo {
  width: 32px;
  height: 32px;
  flex: none;
}

.badge {
  fill: var(--accent);
}

.mixer {
  fill: var(--bg);
}

.legs {
  fill: none;
  stroke: var(--bg);
  stroke-width: 2.4;
  stroke-linecap: round;
}
</style>
