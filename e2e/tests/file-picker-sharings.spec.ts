import { copyFile } from 'fs/promises'
import path from 'path'

import type { Locator } from '@playwright/test'

import { authenticate } from '../helpers/auth'
import { USERS } from '../helpers/config'
import { expect, safeUnlink, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'
import { DrivePage } from '../pages/DrivePage'
import { FilePickerPage } from '../pages/FilePickerPage'

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')

test.describe.serial('File Picker Sharings', () => {
  const rootName = `PickerShare-${stamp()}`
  const nestedName = `PickerNested-${stamp()}`
  const fileName = `picker-shared-${stamp()}.txt`

  test.beforeAll(async ({ browser, contextOptions }) => {
    const aliceContext = await browser.newContext(contextOptions)
    const bobContext = await browser.newContext(contextOptions)

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

      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, rootName)
      const rootUrl = alicePage.url()
      await aliceDrive.row(nestedName).open()
      await alicePage.waitForURL(url => url.toString() !== rootUrl)

      const tmpPath = path.join(path.dirname(FIXTURE), fileName)
      await copyFile(FIXTURE, tmpPath)
      try {
        await aliceDrive.uploadFiles(tmpPath)
        await aliceDrive.row(fileName).waitVisible()
      } finally {
        await safeUnlink(tmpPath)
      }

      await openSharedDrive(bobPage, USERS.bob, bobDrive, rootName)
    } finally {
      await aliceContext.close()
      await bobContext.close()
    }
  })

  test('browses a shared drive and sends a nested file as an attachment', async ({
    bobPage
  }) => {
    const picker = new FilePickerPage(bobPage, USERS.bob)
    // The shared root is a folder, so use the public-link action to observe
    // selection reset before generating a download link for the nested file.
    await picker.open()

    const frame = bobPage.frameLocator('iframe[src*="intents"]')
    const row = (name: string): Locator =>
      frame
        .getByTestId('list-item')
        .filter({ has: frame.getByTitle(name, { exact: true }) })
    const breadcrumb = frame.getByTestId('file-picker-breadcrumb')
    const myDriveTab = frame.getByRole('tab', { name: /My Drive/i })
    const sharingsTab = frame.getByRole('tab', { name: /Sharings/i })
    const publicLinkButton = frame.getByTestId('public-link-btn')
    const downloadLinkButton = frame.getByTestId('temporary-download-link-btn')

    await expect(myDriveTab).toHaveAttribute('aria-selected', 'true')
    await expect(sharingsTab).toBeVisible()
    await expect(breadcrumb).toContainText('My Drive')
    await expect(downloadLinkButton).toBeDisabled()

    await sharingsTab.click()
    await expect(sharingsTab).toHaveAttribute('aria-selected', 'true')
    await expect(breadcrumb).toHaveText('Sharings')
    await expect(row(rootName)).toBeVisible()

    await row(rootName).getByTestId('choice-onclick').click()
    await expect(publicLinkButton).toBeEnabled()

    await myDriveTab.click()
    await expect(breadcrumb).toHaveText('My Drive')
    await expect(publicLinkButton).toBeDisabled()

    await sharingsTab.click()
    await expect(breadcrumb).toHaveText('Sharings')
    await expect(row(rootName)).toBeVisible()
    await expect(publicLinkButton).toBeDisabled()

    await row(rootName).getByTestId('listitem-onclick').dblclick()
    await expect(breadcrumb).toContainText('Sharings')
    await expect(row(nestedName)).toBeVisible()

    await row(nestedName).getByTestId('listitem-onclick').dblclick()
    await expect(breadcrumb).toContainText('Sharings')
    await expect(row(fileName)).toBeVisible()

    await breadcrumb
      .getByRole('button', { name: 'Sharings', exact: true })
      .click()
    await expect(breadcrumb).toHaveText('Sharings')
    await expect(row(rootName)).toBeVisible()

    await row(rootName).getByTestId('listitem-onclick').dblclick()
    await expect(row(nestedName)).toBeVisible()
    await row(nestedName).getByTestId('listitem-onclick').dblclick()
    await expect(row(fileName)).toBeVisible()

    await row(fileName).getByTestId('choice-onclick').click()
    await expect(downloadLinkButton).toBeEnabled()

    await picker.clickTemporaryDownloadLink()
    await picker.waitForClosed()

    const link = await picker.getConfirmationLink()
    expect(link).toMatch(/^https?:\/\//)

    const document = await picker.getResultDocument()
    expect(Array.isArray(document)).toBe(true)
    const [entry] = document as Array<Record<string, unknown>>
    expect(entry.name).toBe(fileName)
    expect(entry.downloadLink).toBe(link)
    expect(entry.sharingLink).toBeUndefined()

    const response = await bobPage.request.get(link)
    expect(response.status()).toBeLessThan(400)

    await picker.closeConfirmation()
  })
})
