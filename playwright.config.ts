import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 120000,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/next/dist/bin/next dev --webpack -p 3100', url: 'http://localhost:3100', reuseExistingServer: !process.env.CI, timeout: 120000 },
  projects: [
    { name: 'desktop', testMatch: /storefront\.spec\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', testMatch: /storefront\.spec\.ts/, use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chrome' } },
    { name: 'security', testMatch: /security\.spec\.ts/ },
  ],
});

