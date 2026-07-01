import { copyFile, writeFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, safeUnlink, stamp } from '../helpers/fixtures'
import { FilePickerPage } from '../pages/FilePickerPage'

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')

/**
 * File Picker end-to-end tests.
 *
 * The picker is opened via the "Pick a file" sidebar button (gated by the
 * `drive.file-picker-demo.enabled` flag, activated via stack feature flags).
 * It renders inside an iframe — all interactions inside the picker are scoped
 * to that iframe.  After a link is generated, a confirmation dialog appears
 * in the parent page.
 */
test.describe('File Picker', () => {
  let parentFolder: string
  let testFileName: string
  let largeFileName: string

  test.beforeAll(async ({ alicePage, aliceDrive }) => {
    // Create an isolated parent folder with a test file inside it.
    parentFolder = `picker-${stamp()}`
    testFileName = `picker-${stamp()}.txt`
    largeFileName = `picker-large-${stamp()}.txt`

    await alicePage.goto(`${USERS.alice.appUrl}/#/folder?flags`)
    await aliceDrive.createFolder(parentFolder)

    // Enter the parent folder and upload a file.
    await aliceDrive.row(parentFolder).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)

    const tmpPath = path.join(path.dirname(FIXTURE), testFileName)
    const largeTmpPath = path.join(path.dirname(FIXTURE), largeFileName)
    await copyFile(FIXTURE, tmpPath)
    await writeFile(largeTmpPath, 'x'.repeat(2048))
    try {
      await aliceDrive.uploadFiles([tmpPath, largeTmpPath])
      await aliceDrive.row(testFileName).waitVisible()
      await aliceDrive.row(largeFileName).waitVisible()
    } finally {
      await safeUnlink(tmpPath)
      await safeUnlink(largeTmpPath)
    }
  })

  test.beforeEach(async ({ alicePage }) => {
    // Every test starts from Drive root.
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
  })

  // ---------------------------------------------------------------------------
  // 1. Pick a file → public sharing link
  // ---------------------------------------------------------------------------
  test('pick a file and generate a public sharing link', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.open()

    // Navigate into the parent folder then select the test file.
    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)

    // Footer buttons should be enabled once a file is selected.
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.clickPublicLink()
    await picker.waitForClosed()

    const link = await picker.getConfirmationLink()
    expect(link).toMatch(/^https?:\/\//)

    // Open the link in a new tab — the Cozy public page should load
    // (heading visible) or show a download button.
    const publicPage = await alicePage.context().newPage()
    try {
      await publicPage.goto(link)
      await expect(publicPage.getByRole('heading').first()).toBeVisible({
        timeout: 10_000
      })
    } finally {
      await publicPage.close()
    }

    await picker.closeConfirmation()
  })

  // ---------------------------------------------------------------------------
  // 2. Pick a file → temporary download link
  // ---------------------------------------------------------------------------
  test('pick a file and generate a temporary download link', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.open()

    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)

    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(false)

    await picker.clickTemporaryDownloadLink()
    await picker.waitForClosed()

    const link = await picker.getConfirmationLink()
    expect(link).toMatch(/^https?:\/\//)

    // The temporary download link is a direct file download URL.
    // Use the API request context to check the HTTP status.
    const response = await alicePage.request.get(link)
    expect(response.status()).toBeLessThan(400)

    await picker.closeConfirmation()
  })

  // ---------------------------------------------------------------------------
  // 3. Pick a folder → public link (temporary download must be disabled)
  // ---------------------------------------------------------------------------
  test('pick a folder: temporary download is disabled, public link works', async ({
    alicePage,
    aliceDrive
  }) => {
    // Create a subfolder inside the parent folder that we'll pick.
    await aliceDrive.row(parentFolder).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)
    const subFolder = `sub-${stamp()}`
    await aliceDrive.createFolder(subFolder)

    const picker = new FilePickerPage(alicePage)
    await picker.open()

    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(subFolder)

    // Temporary download link must be disabled for folders.
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
    // Public link must be enabled.
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.clickPublicLink()
    await picker.waitForClosed()

    const link = await picker.getConfirmationLink()
    expect(link).toMatch(/^https?:\/\//)

    // Open the link — a public folder page should load (HTTP 200).
    const response = await alicePage.request.get(link)
    expect(response.status()).toBeLessThan(400)

    await picker.closeConfirmation()
  })

  // ---------------------------------------------------------------------------
  // 4. Navigate into a folder and select a nested subfolder
  // ---------------------------------------------------------------------------
  test('navigate into a folder and select a nested subfolder', async ({
    alicePage,
    aliceDrive
  }) => {
    // Create a nested folder inside the parent folder.
    await aliceDrive.row(parentFolder).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)
    const nested = `nested-${stamp()}`
    await aliceDrive.createFolder(nested)

    const picker = new FilePickerPage(alicePage)
    await picker.open()

    // Navigate into parent via double-click.
    await picker.navigateToFolder(parentFolder)

    // Now inside parent, we should see both the test file and the nested folder.
    // Select the nested subfolder.
    await picker.selectItem(nested)

    // Temporary download should be disabled (it's a folder).
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)

    await picker.clickPublicLink()
    await picker.waitForClosed()

    const link = await picker.getConfirmationLink()
    expect(link).toMatch(/^https?:\/\//)

    await picker.closeConfirmation()
  })

  test('download-only config hides public link and returns a download link', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.open('Download link only')

    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)

    await expect(picker.hasPublicLinkButton()).resolves.toBe(false)
    await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(true)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(false)

    await picker.clickTemporaryDownloadLink()
    await picker.waitForClosed()

    const document = await picker.getResultDocument()
    expect(Array.isArray(document)).toBe(true)
    const [entry] = document as Array<Record<string, unknown>>
    expect(entry.downloadLink).toMatch(/^https?:\/\//)
    expect(entry.sharingLink).toBeUndefined()

    await picker.closeConfirmation()
  })

  test('sharing-only config hides download link and returns a sharing link', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.open('Sharing link only')

    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)

    await expect(picker.hasPublicLinkButton()).resolves.toBe(true)
    await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(false)
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.clickPublicLink()
    await picker.waitForClosed()

    const document = await picker.getResultDocument()
    expect(Array.isArray(document)).toBe(true)
    const [entry] = document as Array<Record<string, unknown>>
    expect(entry.sharingLink).toMatch(/^https?:\/\//)
    expect(entry.downloadLink).toBeUndefined()

    await picker.closeConfirmation()
  })

  test('image-only config disables temporary download for a text file', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.open('Image only')

    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)

    await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(true)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
  })

  test('max-size config disables temporary download for a large file', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.open('Max size 1 KB')

    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(largeFileName)

    await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(true)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
  })

  test('confirmation dialog exposes the raw result document', async ({
    alicePage
  }) => {
    const picker = new FilePickerPage(alicePage)
    await picker.open('Default (sharing + download)')

    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)
    await picker.clickPublicLink()
    await picker.waitForClosed()

    const document = await picker.getResultDocument()
    expect(Array.isArray(document)).toBe(true)
    const [entry] = document as Array<Record<string, unknown>>
    expect(entry.id).toEqual(expect.any(String))
    expect(entry.name).toBe(testFileName)
    expect(entry.size).toEqual(expect.any(Number))
    expect(entry.mimeType).toEqual(expect.any(String))
    expect(entry.sharingLink).toMatch(/^https?:\/\//)
    expect(entry.downloadLink).toBeUndefined()

    await picker.closeConfirmation()
  })
})
