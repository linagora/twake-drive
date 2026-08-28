import { copyFile } from 'fs/promises'
import path from 'path'

import type { Locator } from '@playwright/test'

import { authenticate } from '../helpers/auth'
import { USERS } from '../helpers/config'
import { test, expect, safeUnlink, stamp } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import { DrivePage } from '../pages/DrivePage'
import { FilePickerPage } from '../pages/FilePickerPage'

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')

test.describe('File Picker mobile', () => {
  let parentFolder: string
  let fileName: string
  let folderName: string

  test.beforeAll(async ({ browser }) => {
    parentFolder = `000-picker-mobile-${stamp()}`
    fileName = `picker-mobile-${stamp()}.txt`
    folderName = `picker-mobile-folder-${stamp()}`

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    })
    const page = await context.newPage()
    const drive = new DrivePage(page)
    const tmpPath = path.join(path.dirname(FIXTURE), fileName)

    try {
      await authenticate(page, 'alice')
      await page.goto(`${USERS.alice.appUrl}/#/folder?flags`)
      await drive.createFolder(parentFolder)
      await drive.openFolder(parentFolder)
      await drive.createFolder(folderName)
      await copyFile(FIXTURE, tmpPath)
      await drive.uploadFiles(tmpPath)
      await drive.row(fileName).waitVisible()
    } finally {
      await safeUnlink(tmpPath)
      await context.close()
    }
  })

  test('supports the focused touch flow in a full-screen intent', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.openMobile()

    const viewport = alicePage.viewportSize()
    if (!viewport) throw new Error('Mobile project requires a viewport')
    expect(viewport.width).toBeLessThan(600)
    expect(
      await alicePage.evaluate(() => navigator.maxTouchPoints)
    ).toBeGreaterThan(0)
    expect(await alicePage.getByRole('dialog').boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    })

    await picker.navigateToFolderOnMobile(parentFolder)
    await picker.tapItem(fileName)
    await expect.poll(() => picker.getCheckboxCount()).toBe(2)
    await expect(picker.isItemChecked(fileName)).resolves.toBe(true)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(false)
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.tapItem(fileName)
    await expect.poll(() => picker.getCheckboxCount()).toBe(0)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(true)

    await picker.navigateToFolderOnMobile(folderName)
    await picker.navigateBackOnMobile(parentFolder)
    await picker.longPressItem(folderName)

    await expect.poll(() => picker.getCheckboxCount()).toBe(2)
    await expect(picker.isItemChecked(folderName)).resolves.toBe(true)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)
  })
})

test.describe.serial('File Picker Sharings mobile', () => {
  const rootName = `PickerShareMobile-${stamp()}`
  const nestedName = `PickerNestedMobile-${stamp()}`

  test.beforeAll(async ({ browser }) => {
    const aliceContext = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    })
    const bobContext = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    })
    try {
      const alicePage = await aliceContext.newPage()
      const bobPage = await bobContext.newPage()
      const aliceDrive = new DrivePage(alicePage)
      const bobDrive = new DrivePage(bobPage)
      await authenticate(alicePage, 'alice')
      await authenticate(bobPage, 'bob')

      await createAndShareFolderWithBob(alicePage, aliceDrive, rootName, {
        seed: async () => {
          await aliceDrive.createFolder(nestedName)
        }
      })
      await openSharedDrive(bobPage, USERS.bob, bobDrive, rootName)
    } finally {
      await aliceContext.close()
      await bobContext.close()
    }
  })

  test('navigates into a sharing', async ({ bobPage }) => {
    const picker = new FilePickerPage(bobPage, USERS.bob)
    await picker.openMobile()

    const frame = bobPage.frameLocator('iframe[src*="intents"]')
    const row = (name: string): Locator =>
      frame
        .getByTestId('list-item')
        .filter({ has: frame.getByTitle(name, { exact: true }) })
    const breadcrumb = frame.getByTestId('file-picker-breadcrumb')
    const myDriveTab = frame.getByRole('tab', { name: /My Drive/i })
    const sharingsTab = frame.getByRole('tab', { name: /Sharings/i })

    await expect(myDriveTab).toBeVisible()
    await expect(sharingsTab).toBeVisible()
    await sharingsTab.tap()
    await expect(sharingsTab).toHaveAttribute('aria-selected', 'true')
    await expect(breadcrumb).toHaveText('Sharings')
    await expect(row(rootName)).toBeVisible()

    await picker.tapItem(rootName)
    await expect(row(nestedName)).toBeVisible()
  })
})
