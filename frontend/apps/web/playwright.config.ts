import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 90000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/results/html', open: 'never' }],
  ],
  use: {
    // CI smoke tests exercise the deployed production site. Local runs can
    // override this explicitly with BASE_URL when another target is needed.
    baseURL: process.env.BASE_URL || 'https://urbanservice.me/',
    actionTimeout: 30000,
    navigationTimeout: 30000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    launchOptions: {
      slowMo: 0,
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'smoke',
      testMatch: ['tests/smoke/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'destructive',
      testMatch: ['tests/destructive/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'tests/results/videos',
});
