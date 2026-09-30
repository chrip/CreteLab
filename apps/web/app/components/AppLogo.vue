<template>
  <!-- A reinforcement mesh, the upper-left half covered by poured concrete with a spark of AI in it. -->
  <svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <defs>
      <clipPath :id="`${id}-in`"><rect x="2.7" y="2.7" width="26.6" height="26.6" rx="5.3" /></clipPath>
      <clipPath :id="`${id}-out`"><rect width="32" height="32" rx="8" /></clipPath>
      <!-- The spark is cut out of the concrete. -->
      <mask :id="`${id}-spark`">
        <rect width="32" height="32" fill="#fff" />
        <path d="M8.6 20.1 Q9.59 22.41 11.9 23.4 Q9.59 24.39 8.6 26.7 Q7.61 24.39 5.3 23.4 Q7.61 22.41 8.6 20.1 Z" fill="#000" />
      </mask>
      <!-- A transparent gap between the concrete and the mesh, so the edge reads on any background. -->
      <mask :id="`${id}-gap`">
        <rect width="32" height="32" fill="#fff" />
        <path :d="CONCRETE" fill="#000" stroke="#000" stroke-width="2.6" stroke-linejoin="round" />
      </mask>
    </defs>
    <!-- Mirrored top to bottom, so the edge of the pour rises to the right. -->
    <g transform="matrix(1 0 0 -1 0 32)">
      <g class="mesh" :mask="`url(#${id}-gap)`">
        <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="6.4" />
        <path :clip-path="`url(#${id}-in)`" d="M9.5 0 V32 M16 0 V32 M22.5 0 V32 M0 9.5 H32 M0 16 H32 M0 22.5 H32" />
      </g>
      <g :mask="`url(#${id}-spark)`">
        <path class="fill" :clip-path="`url(#${id}-out)`" :d="CONCRETE" />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
// The concrete edge follows the diagonal with a gentle wave (a pour front, not a ruler line).
const CONCRETE = 'M-2.85 -1.15 L-1.91 -0.59 L-0.97 -0.03 L-0.05 0.55 L0.85 1.15 L1.72 1.78 L2.57 2.43 L3.37 3.13 L4.14 3.86 L4.87 4.63 L5.57 5.43 L6.22 6.28 L6.85 7.15 L7.45 8.05 L8.03 8.97 L8.59 9.91 L9.15 10.85 L9.71 11.79 L10.27 12.73 L10.85 13.65 L11.45 14.55 L12.08 15.42 L12.74 16.26 L13.43 17.07 L14.16 17.84 L14.93 18.57 L15.74 19.26 L16.58 19.92 L17.45 20.55 L18.35 21.15 L19.27 21.73 L20.21 22.29 L21.15 22.85 L22.09 23.41 L23.03 23.97 L23.95 24.55 L24.85 25.15 L25.72 25.78 L26.57 26.43 L27.37 27.13 L28.14 27.86 L28.87 28.63 L29.57 29.43 L30.22 30.28 L30.85 31.15 L31.45 32.05 L32.03 32.97 L32.59 33.91 L33.15 34.85 L-2 34 Z';
// Clip and mask ids must be unique on the page.
const id = `logo-${useId()}`;
</script>

<style scoped>
.logo {
  width: 32px;
  height: 32px;
  flex: none;
}

.mesh {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.2;
}

.fill {
  fill: var(--accent);
}
</style>
