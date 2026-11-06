import { execFileSync } from 'child_process'
import { copyFile } from 'fs/promises'
import path from 'path'

import type { Browser, Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import {
  createFile,
  createFolder,
  findLinkPermission,
  setLinkExpiry,
  trashById
} from '../helpers/stack'
import {
  escapeRegExp,
  test,
  expect,
  safeUnlink,
  stamp
} from '../helpers/fixtures'
import { t } from '../helpers/i18n'
import type { DrivePage } from '../pages/DrivePage'
import { ShareModalPage } from '../pages/ShareModalPage'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'
import { PublicLinkPage } from '../pages/PublicLinkPage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`
const WRITE_ACTIONS = new RegExp(
  [
    'SelectionBar.rename',
    'SelectionBar.moveto',
    'actions.duplicateTo.label',
    'SelectionBar.trash'
  ]
    .map(key => escapeRegExp(t(key)))
    .join('|'),
  'i'
)
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')

/** MM/dd/yyyy for the English DatePicker, `offsetDays` from today. */
function localeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

/** Close and reopen the share modal so it remounts and re-reads the sharing
 * context; the "Public access" row only updates from freshly read permissions. */
async function reopenShareModal(page: Page, drive: DrivePage): Promise<void> {
  await new ShareModalPage(page).dismiss()
  await drive.openShareModal()
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

  await drive.openShareModal()
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
  test('downloads the public folder as a ZIP with its nested files', async ({
    alicePage,
    aliceDrive,
    publicPage
  }) => {
    await alicePage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])

    const folderName = `Public ZIP ${stamp()}`
    const folderId = await createFolder({
      instance: USERS.alice.instance,
      name: folderName
    })
    try {
      const nestedId = await createFolder({
        instance: USERS.alice.instance,
        name: 'nested',
        parentId: folderId
      })
      await createFile({
        instance: USERS.alice.instance,
        name: 'root.txt',
        content: 'root content',
        parentId: folderId
      })
      await createFile({
        instance: USERS.alice.instance,
        name: 'nested.txt',
        content: 'nested content',
        parentId: nestedId
      })

      await alicePage.goto(`${ALICE_ROOT}/${folderId}`)
      await aliceDrive.row('root.txt').waitVisible()
      const modal = await aliceDrive.openShareModal()
      const url = await new ShareByLinkPage(alicePage).createLink()
      await modal.close()

      await publicPage.goto(url)
      const publicLink = new PublicLinkPage(publicPage)
      await expect(publicLink.row('root.txt').cell).toBeVisible()
      await expect(publicLink.row('nested').cell).toBeVisible()
      const download = await publicLink.downloadFolder()
      const archive = await download.path()
      expect(archive).not.toBe(null)
      if (!archive) throw new Error('The folder ZIP was not downloaded')

      const rootPath = `files/${folderName}/root.txt`
      const nestedPath = `files/${folderName}/nested/nested.txt`
      const entries = execFileSync('unzip', ['-Z1', archive], {
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
        .filter(entry => !entry.endsWith('/'))
        .sort()
      expect(entries).toEqual([nestedPath, rootPath])
      expect(
        execFileSync('unzip', ['-p', archive, rootPath], { encoding: 'utf8' })
      ).toBe('root content')
      expect(
        execFileSync('unzip', ['-p', archive, nestedPath], {
          encoding: 'utf8'
        })
      ).toBe('nested content')
    } finally {
      await trashById(USERS.alice.instance, folderId)
    }
  })

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

      await aliceDrive.openShareModal()
      const link = new ShareByLinkPage(alicePage)
      const url = await link.createLink()
      await reopenShareModal(alicePage, aliceDrive)
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

    await reopenShareModal(alicePage, aliceDrive)
    await link.waitForLinkRow()
    await link.openRestrictions()
    await link.enablePassword(password)
    await link.confirm()

    await withAnonymousPage(browser, async pub => {
      await pub.goto(url)
      const publicPage = new PublicLinkPage(pub)
      await publicPage.enterPassword(`wrong-${password}`)
      await expect(publicPage.passwordError).toBeVisible()
      await expect(publicPage.fileList).toHaveCount(0)
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

    const { folderId, link } = await openShareForNewFolder(
      alicePage,
      aliceDrive
    )
    const url = await link.createLink()

    await reopenShareModal(alicePage, aliceDrive)
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
      await expect(publicPage.unavailableMessage).toBeVisible({
        timeout: 15_000
      })
      await expect(publicPage.fileList).toHaveCount(0)
    })
  })

  test('a viewer link is read-only and stops working once deactivated', async ({
    alicePage,
    aliceDrive,
    publicPage
  }) => {
    await alicePage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])

    const { folderId, link } = await openShareForNewFolder(
      alicePage,
      aliceDrive
    )
    const fileName = `public-${stamp()}.txt`
    const content = `public content ${stamp()}`
    await createFile({
      instance: USERS.alice.instance,
      name: fileName,
      content,
      parentId: folderId
    })
    const url = await link.createLink()

    const visitor = new PublicLinkPage(publicPage)
    await visitor.open(url)
    await expect(visitor.row(fileName).cell).toBeVisible({ timeout: 15_000 })
    await expect(visitor.addButtons).toHaveCount(0)
    const items = await visitor.rowMenuItems(fileName)
    expect(items).toContain(t('SelectionBar.download'))
    expect(items.filter(item => WRITE_ACTIONS.test(item))).toEqual([])

    const sharecode = url.match(/sharecode=([^&#]+)/)?.[1]
    if (!sharecode) throw new Error(`No sharecode in ${url}`)
    await expect(
      createFile({
        instance: USERS.alice.instance,
        name: `intruder-${stamp()}.txt`,
        content: 'written through the link',
        parentId: folderId,
        token: sharecode
      })
    ).rejects.toThrow(/\(403\)/)

    await visitor.row(fileName).open()
    await visitor.expectFileContent(content)

    await reopenShareModal(alicePage, aliceDrive)
    await link.waitForLinkRow()
    await link.deactivate()
    await expect
      .poll(async () => {
        try {
          await findLinkPermission(USERS.alice.instance, folderId)
          return true
        } catch (err) {
          if (/No share-by-link permission/.test(String(err))) return false
          throw err
        }
      })
      .toBe(false)

    await publicPage.reload()
    await expect(visitor.unavailableMessage).toBeVisible({ timeout: 15_000 })
    await expect(visitor.fileList).toHaveCount(0)
  })
})
