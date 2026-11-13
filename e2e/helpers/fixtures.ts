import { unlink } from 'fs/promises'

import { test as base, expect } from '@playwright/test'
import type {
  Browser,
  BrowserContextOptions,
  Locator,
  Page,
  TestInfo
} from '@playwright/test'

import { authenticate } from './auth'
import type { UserLabel } from './config'
import { DrivePage } from '../pages/DrivePage'

type AuthedFixtures = {
  publicPage: Page
  alicePage: Page
  bobPage: Page
  charliePage: Page
  aliceDrive: DrivePage
  bobDrive: DrivePage
  charlieDrive: DrivePage
}

type ContextFixtures = {
  browser: Browser
  contextOptions: BrowserContextOptions
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

const BADGE_COLORS: Record<UserLabel, string> = {
  alice: '#1565c0',
  bob: '#e65100',
  charlie: '#2e7d32'
}

/** Runs in the page of a recorded run: pins the acting user's name in the
 * top-left corner, so a video tells whose browser it shows. The name is drawn
 * by a pseudo-element, which text locators never match. */
const showUserBadge = ({
  label,
  color
}: {
  label: string
  color: string
}): void => {
  if (window !== window.top) return
  const mount = (): void => {
    const style = document.createElement('style')
    style.textContent = `#e2e-user-badge{position:fixed;top:8px;left:8px;z-index:2147483647;pointer-events:none;padding:6px 18px;border-radius:18px;background:${color};color:#fff;font:bold 20px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35)}#e2e-user-badge::after{content:'${label}'}`
    const badge = document.createElement('div')
    badge.id = 'e2e-user-badge'
    badge.setAttribute('aria-hidden', 'true')
    document.head.append(style)
    document.body.append(badge)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
}

const userPageFixture =
  (user: UserLabel) =>
  async (
    { browser, contextOptions }: ContextFixtures,
    use: (page: Page) => Promise<void>,
    testInfo: TestInfo
  ): Promise<void> => {
    const ctx = await browser.newContext(contextOptions)
    const recording = Boolean(process.env.E2E_VIDEO)
    if (recording) {
      await ctx.addInitScript(showUserBadge, {
        label: user.charAt(0).toUpperCase() + user.slice(1),
        color: BADGE_COLORS[user]
      })
    }
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    let page: Page | null = null
    try {
      page = await ctx.newPage()
      page.on('console', msg => {
        if (msg.type() !== 'error') return
        const text = msg.text()
        if (IGNORED_CONSOLE.some(re => re.test(text))) return
        const loc = msg.location()
        consoleErrors.push(`[${user}] ${text}  (${loc.url}:${loc.line})`)
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
      // Named after the user, so each test's videos tell who acts in them.
      const video = recording ? page?.video() : null
      if (video) {
        await video.saveAs(testInfo.outputPath(`${user}.webm`))
        await video.delete()
      }
    }
  }

export const test = base.extend<AuthedFixtures>({
  publicPage: async ({ browser, contextOptions }, use) => {
    const context = await browser.newContext(contextOptions)
    try {
      await use(await context.newPage())
    } finally {
      await context.close()
    }
  },
  alicePage: userPageFixture('alice'),
  bobPage: userPageFixture('bob'),
  charliePage: userPageFixture('charlie'),
  aliceDrive: async ({ alicePage }, use) => {
    await use(new DrivePage(alicePage))
  },
  bobDrive: async ({ bobPage }, use) => {
    await use(new DrivePage(bobPage))
  },
  charlieDrive: async ({ charliePage }, use) => {
    await use(new DrivePage(charliePage))
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

/** Assert that a row locator is visible and marked disabled. */
export const expectRowDisabled = async (row: Locator): Promise<void> => {
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('aria-disabled', 'true')
}
