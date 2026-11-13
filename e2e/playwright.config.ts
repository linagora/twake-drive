import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each worker runs on its own Alice/Bob/Charlie instances (see buildUsers).
  workers: parseInt(process.env.E2E_WORKERS || '1', 10),
  reporter: process.env.CI ? 'html' : 'list',
  globalSetup: './setup/global-setup.ts',
  globalTeardown: './setup/global-teardown.ts',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // E2E_VIDEO=1 records the run at a watchable pace (E2E_SLOWMO=<ms> tunes
    // it), with each user's name pinned on their pages.
    // The fixtures open their own contexts, which the `video` option does not
    // reach, so recording goes through the context options they pass on.
    contextOptions: process.env.E2E_VIDEO
      ? {
          recordVideo: {
            dir: 'test-results/videos',
            size: { width: 1280, height: 720 }
          }
        }
      : {},
    launchOptions: {
      slowMo: Number(
        process.env.E2E_SLOWMO || (process.env.E2E_VIDEO ? 1000 : 0)
      )
    },
    actionTimeout: 10_000
  },
  // Some shared-drive tests chain two cross-instance propagation waits
  // (a 30s sharings-row poll plus a 30s post-action poll), which can exceed
  // 60s on a slow stack; give per-test headroom.
  timeout: 120_000,
  // Covers docker provisioning plus the full suite — the shared-drive specs
  // add ~15 multi-instance tests and the nested-sharing spec runs its five
  // scenarios for every flag combination, on a single worker.
  globalTimeout: 2_100_000,
  projects: [
    {
      name: 'chromium',
      testIgnore: /\.mobile\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'mobile',
      testMatch: /\.mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium'
      }
    }
  ]
})
