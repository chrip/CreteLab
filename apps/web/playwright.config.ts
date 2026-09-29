import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the generated static site. The Laya service is replaced by
// recorded answers of the real model (e2e/fixtures), so the tests need no GPU.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], locale: 'de-DE' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], locale: 'de-DE' } },
  ],
  webServer: {
    command: 'npx nuxt generate && npx serve .output/public -l 4173 --no-port-switching',
    url: 'http://localhost:4173/de',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
