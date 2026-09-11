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
})
