import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de bout en bout (PLAN.md, section 10), sur le site construit, tel
 * qu'il est publié (CSP comprise). En local : npm run e2e (Chromium).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4174/algoweb/',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174/algoweb/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1400, height: 900 } } },
  ],
})
