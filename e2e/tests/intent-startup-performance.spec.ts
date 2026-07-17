import * as fs from 'fs'
import * as path from 'path'

import type { CDPSession, Page, Request, Response } from '@playwright/test'

import { USERS } from '../helpers/config'
import { expect, test } from '../helpers/fixtures'

const RUN_COUNT = 5
const NETWORK_LATENCY_MS = 40
const DOWNLOAD_THROUGHPUT = (1.5 * 1024 * 1024) / 8
const UPLOAD_THROUGHPUT = (750 * 1024) / 8
const CPU_THROTTLING_RATE = 4

interface StartupMetrics {
  firstActionableFileRowMs: number
  javascriptTransferredBeforeInteractionBytes: number
  javascriptRequestCountBeforeInteraction: number
  rootFolderRequestCount: number
  rootFolderSuccessfulRequestCount: number
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const formatMetric = (name: keyof StartupMetrics, values: number[]): string => {
  const unit = name.endsWith('Bytes')
    ? 'bytes'
    : name.endsWith('Count')
      ? 'requests'
      : 'ms'
  return `${name}: ${values
    .map(value => value.toFixed(1))
    .join(', ')} ${unit} (median ${median(values).toFixed(1)} ${unit})`
}

const isRootListingRequest = (request: Request): boolean => {
  if (!request.frame().url().includes('/intents?')) return false
  if (request.method() !== 'POST') return false
  if (new URL(request.url()).pathname !== '/files/_find') return false
  const body = request.postDataJSON() as {
    selector?: { dir_id?: string }
  } | null
  return body?.selector?.dir_id === 'io.cozy.files.root-dir'
}

const configureChromium = async (page: Page): Promise<CDPSession> => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: NETWORK_LATENCY_MS,
    downloadThroughput: DOWNLOAD_THROUGHPUT,
    uploadThroughput: UPLOAD_THROUGHPUT
  })
  await cdp.send('Emulation.setCPUThrottlingRate', {
    rate: CPU_THROTTLING_RATE
  })
  return cdp
}

const recordRun = async (page: Page, run: number): Promise<StartupMetrics> => {
  const cdp = await configureChromium(page)
  let rootFolderRequestCount = 0
  let rootFolderSuccessfulRequestCount = 0
  let rootFolderRequestsInFlight = 0
  const handleRequest = (request: Request): void => {
    if (!isRootListingRequest(request)) return
    rootFolderRequestCount += 1
    rootFolderRequestsInFlight += 1
  }
  const handleResponse = (response: Response): void => {
    if (!isRootListingRequest(response.request())) return
    if (response.ok()) rootFolderSuccessfulRequestCount += 1
  }
  const handleFinished = (request: Request): void => {
    if (isRootListingRequest(request)) rootFolderRequestsInFlight -= 1
  }
  page.on('request', handleRequest)
  page.on('response', handleResponse)
  page.on('requestfinished', handleFinished)
  page.on('requestfailed', handleFinished)

  try {
    // This listener records the browser's real DOM click, not the time before
    // Playwright dispatches the click. It is deliberately outside File Picker.
    await page.evaluate(() => {
      ;(window as Window & { pickerClickAt?: number | null }).pickerClickAt =
        null
      document.addEventListener(
        'click',
        event => {
          const target = event.target as HTMLElement
          const button = target.closest('button')
          if (
            button
              ?.getAttribute('aria-label')
              ?.toLowerCase()
              .match(/pick a file|choisir un fichier/) ||
            button?.textContent
              ?.toLowerCase()
              .match(/pick a file|choisir un fichier/)
          ) {
            ;(
              window as Window & { pickerClickAt?: number | null }
            ).pickerClickAt = performance.now()
          }
        },
        { capture: true, once: true }
      )
    })
    const javascriptMetrics = await page.evaluate(() => {
      const javascriptEntries = performance
        .getEntriesByType('resource')
        .filter(
          entry =>
            (entry as PerformanceResourceTiming).initiatorType === 'script'
        ) as PerformanceResourceTiming[]
      return {
        bytes: javascriptEntries.reduce(
          (total, entry) => total + entry.transferSize,
          0
        ),
        requests: javascriptEntries.length
      }
    })
    await page
      .getByRole('button', { name: /pick a file|choisir un fichier/i })
      .click()
    const frame = page.frameLocator('iframe[src*="intents"]')
    const row = frame.getByTestId('list-item').first()
    // trial performs Playwright's full actionability checks without dispatching
    // the row click (and therefore cannot select or open the file).
    await row.click({ trial: true })
    const firstActionableFileRowMs = await page.evaluate(() => {
      const clickAt = (window as Window & { pickerClickAt?: number | null })
        .pickerClickAt
      return clickAt === null || clickAt === undefined
        ? -1
        : performance.now() - clickAt
    })
    await expect.poll(() => rootFolderRequestsInFlight).toBe(0)
    expect(rootFolderRequestCount).toBeGreaterThan(0)
    expect(rootFolderSuccessfulRequestCount).toBeGreaterThan(0)
    return {
      firstActionableFileRowMs,
      javascriptTransferredBeforeInteractionBytes: javascriptMetrics.bytes,
      javascriptRequestCountBeforeInteraction: javascriptMetrics.requests,
      rootFolderRequestCount,
      rootFolderSuccessfulRequestCount
    }
  } finally {
    page.removeListener('request', handleRequest)
    page.removeListener('response', handleResponse)
    page.removeListener('requestfinished', handleFinished)
    page.removeListener('requestfailed', handleFinished)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
    await cdp.detach()
    process.stdout.write(
      `run ${run}: root requests ${rootFolderRequestCount}, successful ${rootFolderSuccessfulRequestCount}\n`
    )
    await page.keyboard.press('Escape')
    await page
      .locator('iframe[src*="intents"]')
      .waitFor({ state: 'detached', timeout: 10_000 })
      .catch(() => null)
  }
}

test('records a browser-cache-cold Chromium File Picker startup baseline', async ({
  benchmarkPage
}) => {
  test.setTimeout(300_000)
  benchmarkPage.setDefaultTimeout(60_000)
  await benchmarkPage.goto(`${USERS.benchmark.appUrl}/#/folder`)
  await benchmarkPage
    .getByRole('button', { name: /pick a file|choisir un fichier/i })
    .waitFor({ state: 'visible', timeout: 60_000 })

  await recordRun(benchmarkPage, 0) // unrecorded warm-up
  const measurements: StartupMetrics[] = []
  for (let run = 1; run <= RUN_COUNT; run += 1) {
    measurements.push(await recordRun(benchmarkPage, run))
  }
  expect(measurements).toHaveLength(RUN_COUNT)
  expect(
    measurements.every(metric => metric.firstActionableFileRowMs > 0)
  ).toBe(true)

  const report = (Object.keys(measurements[0]) as Array<keyof StartupMetrics>)
    .map(name =>
      formatMetric(
        name,
        measurements.map(metric => metric[name])
      )
    )
    .join('\n')
  const campaignOutput = process.env.PERFORMANCE_OUTPUT
  if (campaignOutput) {
    const output = {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      variant: process.env.PERFORMANCE_VARIANT ?? null,
      environment: {
        browser: 'chromium',
        viewport: { width: 1280, height: 720 },
        runs: RUN_COUNT,
        warmups: 1,
        cache: 'disabled',
        network: {
          latencyMs: NETWORK_LATENCY_MS,
          downloadBytesPerSecond: DOWNLOAD_THROUGHPUT,
          uploadBytesPerSecond: UPLOAD_THROUGHPUT
        },
        cpuThrottlingRate: CPU_THROTTLING_RATE
      },
      runs: measurements,
      medians: Object.fromEntries(
        (Object.keys(measurements[0]) as Array<keyof StartupMetrics>).map(
          name => [name, median(measurements.map(metric => metric[name]))]
        )
      )
    }
    fs.mkdirSync(path.dirname(campaignOutput), { recursive: true })
    fs.writeFileSync(campaignOutput, `${JSON.stringify(output, null, 2)}\n`)
  }

  process.stdout.write(
    `\nChromium File Picker startup baseline (browser-cache cold, ${RUN_COUNT} runs)\nProfile: CPU x${CPU_THROTTLING_RATE}, network ${NETWORK_LATENCY_MS}ms / ${(
      (DOWNLOAD_THROUGHPUT * 8) /
      1024 /
      1024
    ).toFixed(2)}Mbps down / ${((UPLOAD_THROUGHPUT * 8) / 1024 / 1024).toFixed(
      2
    )}Mbps up, viewport 1280x720\n${report}\n`
  )
})
