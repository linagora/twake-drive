import { unlink } from 'fs/promises'
import { test as base, expect } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

import { authenticate } from './auth'
import { DrivePage } from '../pages/DrivePage'

type AuthedFixtures = {
  alicePage: Page
  bobPage: Page
  benchmarkPage: Page
  aliceDrive: DrivePage
  bobDrive: DrivePage
}

// Console messages we never want to fail on — benign in the test stack
const IGNORED_CONSOLE = [
  /Failed to load resource: the server responded with a status of 404/,
  /<svg> attribute width: Expected length/
]

const attachIfAny = async (
  testInfo: TestInfo,
  name: string,
  lines: string[]
): Promise<void> => {
  if (lines.length === 0) return
  await testInfo.attach(name, {
    body: lines.join('\n'),
    contentType: 'text/plain'
  })
}

const userPageFixture =
  (user: 'alice' | 'bob' | 'benchmark') =>
  async (
    { browser }: { browser: import('@playwright/test').Browser },
    use: (page: Page) => Promise<void>,
    testInfo: TestInfo
  ): Promise<void> => {
    const ctx = await browser.newContext()
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    try {
      const page = await ctx.newPage()
      page.on('console', msg => {
        if (msg.type() !== 'error') return
        const text = msg.text()
        if (IGNORED_CONSOLE.some(re => re.test(text))) return
        const loc = msg.location()
        consoleErrors.push(`[${user}] ${text}  (${loc.url}:${loc.lineNumber})`)
      })
      page.on('pageerror', err => {
        pageErrors.push(
          `[${user}] ${err.name}: ${err.message}\n${err.stack ?? ''}`
        )
      })
      await authenticate(page, user)
      await use(page)
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        await attachIfAny(testInfo, `${user}-console-errors.log`, consoleErrors)
        await attachIfAny(testInfo, `${user}-page-errors.log`, pageErrors)
      }
      await ctx.close()
    }
  }

export const test = base.extend<AuthedFixtures>({
  alicePage: userPageFixture('alice'),
  bobPage: userPageFixture('bob'),
  benchmarkPage: userPageFixture('benchmark'),
  aliceDrive: async ({ alicePage }, use) => {
    await use(new DrivePage(alicePage))
  },
  bobDrive: async ({ bobPage }, use) => {
    await use(new DrivePage(bobPage))
  }
})

export { expect }

let stampCounter = 0
/** Monotonic, collision-resistant identifier for unique fixture names. */
export const stamp = (): string =>
  `${Date.now()}-${process.pid}-${++stampCounter}`

/** Best-effort file deletion — swallows ENOENT so finally-blocks stay clean,
 *  but lets permission / path errors propagate so they aren't silently lost. */
export const safeUnlink = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

/** Escape regex metacharacters so a literal name can be used in a RegExp. */
export const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
