import { defineVitestProject } from '@nuxt/test-utils/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Pure helpers: fast, plain Node.
      { test: { name: 'unit', include: ['test/unit/**/*.test.ts'], environment: 'node' } },
      // Components, rendered inside a Nuxt app with i18n.
      await defineVitestProject({ test: { name: 'nuxt', include: ['test/nuxt/**/*.test.ts'], environment: 'nuxt' } }),
    ],
  },
});
