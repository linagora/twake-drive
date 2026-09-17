import { copyFile } from 'fs/promises'
import path from 'path'

import type { Browser, Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import {
  findLinkPermission,
  setLinkExpiry,
  trashById
} from '../helpers/stack'
import { test, expect, safeUnlink, stamp } from '../helpers/fixtures'
import type { DrivePage } from '../pages/DrivePage'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'
import { PublicLinkPage } from '../pages/PublicLinkPage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')

/** MM/dd/yyyy for the English DatePicker, `offsetDays` from today. */
function localeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

/** Open the share modal from the folder toolbar and wait for the dialog. */
async function openShareModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /share/i }).click()
  await page.getByRole('dialog').waitFor({ state: 'visible' })
}

/** Close and reopen the share modal so it remounts and re-reads the sharing
 * context; the link recipient row only renders from freshly read permissions. */
async function reopenShareModal(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('button', { name: /^(done|close)$/i })
    .first()
    .click()
  await dialog.waitFor({ state: 'hidden' })
  await openShareModal(page)
}

/** Create an empty folder, enter it, open the share modal. Returns the folder
 * id (from the URL) and a ShareByLinkPage to drive the link flow. */
async function openShareForNewFolder(
  page: Page,
  drive: DrivePage
): Promise<{ folderId: string; link: ShareByLinkPage }> {
  await page.goto(ALICE_ROOT)
  const folder = `Linked ${stamp()}`
  await drive.createFolder(folder)
  await drive.row(folder).open()
  await page.waitForURL(/\/folder\/[^/]+$/)
  const folderId = page.url().match(/\/folder\/([^/?]+)/)?.[1] ?? ''
  expect(folderId).not.toBe('')

  await openShareModal(page)
  return { folderId, link: new ShareByLinkPage(page) }
}

/** Run `fn` against a fresh, unauthenticated context (an anonymous visitor). */
async function withAnonymousPage(
  browser: Browser,
  fn: (page: Page) => Promise<void>
): Promise<void> {
  const ctx = await browser.newContext()
  try {
    await fn(await ctx.newPage())
  } finally {
    await ctx.close()
  }
}

test.describe('Share by link', () => {
  test('moves a file into a folder through an editable public link', async ({
    alicePage,
    aliceDrive,
    publicPage
  }) => {
    await alicePage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])

    await alicePage.goto(ALICE_ROOT)
    const sharedFolder = `Public move ${stamp()}`
    const destination = `Destination ${stamp()}`
    const sourceFile = `Public source ${stamp()}.txt`
    const sourcePath = path.join(path.dirname(FIXTURE), sourceFile)
    let sharedFolderId: string | null = null

    await copyFile(FIXTURE, sourcePath)
    try {
      await aliceDrive.createFolder(sharedFolder)
      await aliceDrive.openFolder(sharedFolder)
      sharedFolderId = alicePage.url().match(/\/folder\/([^/?]+)/)?.[1] ?? null
      expect(sharedFolderId).not.toBe(null)

      await aliceDrive.createFolder(destination)
      await aliceDrive.uploadFiles(sourcePath)
      await aliceDrive.row(sourceFile).waitVisible()

      await openShareModal(alicePage)
      const link = new ShareByLinkPage(alicePage)
      const url = await link.createLink()
      await reopenShareModal(alicePage)
      await link.waitForLinkRow()
      await link.allowEditing()

      await publicPage.goto(url)
      const publicLink = new PublicLinkPage(publicPage)
      await expect(publicLink.fileList).toBeVisible({ timeout: 15_000 })

      const moveTo = await publicLink.openMoveTo(sourceFile)
      await moveTo.openFolder(destination)
      await moveTo.confirm()

      await publicLink.row(sourceFile).waitHidden()
      await publicLink.openFolder(destination)
      await expect(publicLink.row(sourceFile).cell).toBeVisible()
    } finally {
      await safeUnlink(sourcePath)
      if (sharedFolderId) {
        await trashById(USERS.alice.instance, sharedFolderId)
      }
    }
  })

  test('a password-protected link challenges before granting access', async ({
    alicePage,
    aliceDrive,
    browser
  }) => {
    await alicePage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])

    const { link } = await openShareForNewFolder(alicePage, aliceDrive)
    const password = `pw-${stamp()}`
    const url = await link.createLink()
    expect(url).toMatch(/^https?:\/\//)

    await reopenShareModal(alicePage)
    await link.waitForLinkRow()
    await link.openRestrictions()
    await link.enablePassword(password)
    await link.confirm()

    await withAnonymousPage(browser, async pub => {
      await pub.goto(url)
      const publicPage = new PublicLinkPage(pub)
      await publicPage.enterPassword(password)
      await expect(publicPage.fileList).toBeVisible({ timeout: 15_000 })
    })
  })

  test('an expired link is rejected', async ({
    alicePage,
    aliceDrive,
    browser
  }) => {
    await alicePage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])

    const { folderId, link } = await openShareForNewFolder(alicePage, aliceDrive)
    const url = await link.createLink()

    await reopenShareModal(alicePage)
    await link.waitForLinkRow()
    await link.openRestrictions()
    // The picker rejects past dates, so set a future deadline to exercise the
    // happy path, then backdate the permission on the stack to force expiry.
    await link.enableExpiration(localeDate(1))
    await link.confirm()

    const permission = await findLinkPermission(USERS.alice.instance, folderId)
    await setLinkExpiry(
      USERS.alice.instance,
      permission.id,
      new Date('2000-01-01T00:00:00Z')
    )

    await withAnonymousPage(browser, async pub => {
      await pub.goto(url)
      const publicPage = new PublicLinkPage(pub)
      // Assert the rejection positively (the "link no longer available" page)
      // rather than only the absence of content, which the SPA would satisfy
      // momentarily before mounting regardless of expiry.
      await expect(publicPage.unavailableMessage).toBeVisible({ timeout: 15_000 })
      await expect(publicPage.fileList).toHaveCount(0)
    })
  })
})
