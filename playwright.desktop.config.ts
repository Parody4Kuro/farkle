import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-desktop',
  testMatch: '**/*.desktop.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: 'test-results/desktop',
  use: { trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
})
