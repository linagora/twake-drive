import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'html' : 'list',
  globalSetup: './setup/global-setup.ts',
  globalTeardown: './setup/global-teardown.ts',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000
  },
  // Some shared-drive tests chain two cross-instance propagation waits
  // (a 30s sharings-row poll plus a 30s post-action poll), which can exceed
  // 60s on a slow stack; give per-test headroom.
  timeout: 120_000,
  // Covers docker provisioning plus the full suite — the shared-drive specs
  // add ~15 multi-instance tests on a single worker.
  globalTimeout: 900_000,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 }
      }
    }
  ]
})
