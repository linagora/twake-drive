import { copyFile, writeFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, safeUnlink, stamp } from '../helpers/fixtures'
import { findLinkPermission } from '../helpers/stack'
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
  let picker: FilePickerPage

  const pick = async (name: string, configName?: string): Promise<void> => {
    await picker.open(configName)
    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(name)
  }

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
    picker = new FilePickerPage(alicePage)
    await pick(testFileName)

    // Footer buttons should be enabled once a file is selected.
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.openPublicLinkAccess()
    await expect(picker.isLinkAccessOpen()).resolves.toBe(true)
    await expect(picker.hasLinkAccessDocument(testFileName)).resolves.toBe(true)
    await picker.setLinkAccess('Editor')
    await picker.confirmPublicLinks()
    await picker.waitForClosed()

    const link = await picker.getConfirmationLink()
    expect(link).toMatch(/^https?:\/\//)

    const document = await picker.getResultDocument()
    const [entry] = document as Array<{ id: string }>
    const permission = await findLinkPermission(USERS.alice.instance, entry.id)
    const fileRule = Object.values(
      permission.attributes.permissions ?? {}
    ).find(rule => rule.values?.includes(entry.id))
    expect(fileRule?.verbs).toEqual(['GET', 'POST', 'PUT', 'PATCH'])

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
    picker = new FilePickerPage(alicePage)
    await pick(testFileName)

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

    picker = new FilePickerPage(alicePage)
    await pick(subFolder)

    // Temporary download link must be disabled for folders.
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
    // Public link must be enabled.
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.createPublicLinks()
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

    picker = new FilePickerPage(alicePage)
    await pick(nested)

    // Temporary download should be disabled (it's a folder).
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)

    await picker.createPublicLinks()
    await picker.waitForClosed()

    const link = await picker.getConfirmationLink()
    expect(link).toMatch(/^https?:\/\//)

    await picker.closeConfirmation()
  })

  test('download-only config hides public link and returns a download link', async ({
    alicePage
  }) => {
    picker = new FilePickerPage(alicePage)
    await pick(testFileName, 'Download link only')

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
    picker = new FilePickerPage(alicePage)
    await pick(testFileName, 'Sharing link only')

    await expect(picker.hasPublicLinkButton()).resolves.toBe(true)
    await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(false)
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.createPublicLinks()
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
    picker = new FilePickerPage(alicePage)
    await pick(testFileName, 'Image only')

    await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(true)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
  })

  test('max-size config disables temporary download for a large file', async ({
    alicePage
  }) => {
    picker = new FilePickerPage(alicePage)
    await pick(largeFileName, 'Max size 1 KB')

    await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(true)
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
  })

  test('confirmation dialog exposes the raw result document', async ({
    alicePage
  }) => {
    picker = new FilePickerPage(alicePage)
    await pick(testFileName, 'Default (sharing + download)')
    await picker.createPublicLinks()
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

  // ---------------------------------------------------------------------------
  // Multi-file selection
  // ---------------------------------------------------------------------------
  test('select two files and generate one public link per file', async ({
    alicePage
  }) => {
    picker = new FilePickerPage(alicePage)
    await picker.open()
    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)
    await picker.toggleItem(largeFileName)

    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)
    await picker.openPublicLinkAccess()
    await expect(picker.hasLinkAccessDocument(testFileName)).resolves.toBe(true)
    await expect(picker.hasLinkAccessDocument(largeFileName)).resolves.toBe(
      true
    )
    await picker.confirmPublicLinks()
    await picker.waitForClosed()

    const document = await picker.getResultDocument()
    expect(Array.isArray(document)).toBe(true)
    const entries = document as Array<Record<string, unknown>>
    expect(entries).toHaveLength(2)

    for (const entry of entries) {
      expect(entry.sharingLink).toMatch(/^https?:\/\//)
      expect(entry.downloadLink).toBeUndefined()
      expect(entry.id).toEqual(expect.any(String))
      expect(entry.name).toEqual(expect.any(String))
    }

    await picker.closeConfirmation()
  })

  test('select two files and generate one temporary download link per file', async ({
    alicePage
  }) => {
    picker = new FilePickerPage(alicePage)
    await picker.open()
    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)
    await picker.toggleItem(largeFileName)

    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(false)
    await picker.clickTemporaryDownloadLink()
    await picker.waitForClosed()

    const document = await picker.getResultDocument()
    expect(Array.isArray(document)).toBe(true)
    const entries = document as Array<Record<string, unknown>>
    expect(entries).toHaveLength(2)

    for (const entry of entries) {
      expect(entry.downloadLink).toMatch(/^https?:\/\//)
      expect(entry.sharingLink).toBeUndefined()
      expect(entry.id).toEqual(expect.any(String))
      expect(entry.name).toEqual(expect.any(String))
      expect(entry.size).toEqual(expect.any(Number))
      expect(entry.mimeType).toEqual(expect.any(String))
    }

    await picker.closeConfirmation()
  })

  test('select a folder and a file: public link enabled, download disabled', async ({
    alicePage,
    aliceDrive
  }) => {
    await aliceDrive.row(parentFolder).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)
    const subFolder = `sub-${stamp()}`
    await aliceDrive.createFolder(subFolder)

    picker = new FilePickerPage(alicePage)
    await picker.open()
    await picker.navigateToFolder(parentFolder)
    await picker.selectItem(testFileName)
    await picker.toggleItem(subFolder)

    // Download disabled because a folder is in the selection.
    await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(true)
    // Public link still works.
    await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)

    await picker.createPublicLinks()
    await picker.waitForClosed()

    const document = await picker.getResultDocument()
    expect(Array.isArray(document)).toBe(true)
    const entries = document as Array<Record<string, unknown>>
    expect(entries).toHaveLength(2)
    // Both entries should have a sharingLink.
    for (const entry of entries) {
      expect(entry.sharingLink).toMatch(/^https?:\/\//)
      expect(entry.id).toEqual(expect.any(String))
    }

    await picker.closeConfirmation()
  })

  // ---------------------------------------------------------------------------
  // Error handling — inline error alerts
  // ---------------------------------------------------------------------------
  test.describe('Error display', () => {
    test.afterEach(async ({ alicePage }) => {
      await alicePage.unrouteAll({ behavior: 'ignoreErrors' })
    })

    test('shows ITEM_NOT_FOUND when the selected file is missing', async ({
      alicePage
    }) => {
      picker = new FilePickerPage(alicePage)
      await picker.open()
      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(testFileName)

      // Intercept single-file GET requests and return 404 — simulates a
      // file that was deleted between selection and confirmation.
      await alicePage.route(
        url => {
          const seg = url.pathname.split('/').pop() ?? ''
          return (
            url.hostname.includes('cozy.localhost') &&
            url.pathname.startsWith('/files/') &&
            seg !== '' &&
            !seg.startsWith('_')
          )
        },
        route => route.fulfill({ status: 404, body: '{}' }),
        { times: 1 }
      )

      await picker.clickTemporaryDownloadLink()

      // Picker must stay open with an inline error.
      await expect(picker.isOpen()).resolves.toBe(true)
      await expect(picker.isErrorVisible()).resolves.toBe(true)
      const errorText = await picker.getErrorText()
      expect(errorText).toBe('The selected file could not be found.')
    })
  })
})
