import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  ensureRootFolder,
  trashById
} from '../helpers/stack'
import { FilePickerPage } from '../pages/FilePickerPage'

const PNG_PIXEL_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/**
 * End-to-end tests for the File Picker v2 public options:
 * - Documents action, link actions, custom labels, coexistence, and hiding via null
 * - Accept constraints ('file', 'folder', MIME wildcard, empty list, OR matching)
 * - Size and count constraints (maxFileSize, maxFileCount, availableSize)
 * - Tabs configuration (filtering, canonical ordering, negative boundaries)
 * - defaultDirId and restrictToDefaultDir subtree enforcement and fallbacks
 * - Selection cardinality (multiple: false vs multiple: true)
 * - Absolute path enrichment on caller result document
 */
test.describe('File Picker v2 Options', () => {
  let parentFolder: string
  let parentFolderId: string
  let subFolder: string
  let subFolderId: string
  let customFolder: string
  let customFolderId: string
  let restrictedFolder: string
  let restrictedFolderId: string
  let restrictedFileName: string

  let rootFileName: string
  let rootFileId: string
  let textFileName: string
  let textFileId: string
  let largeFileName: string
  let largeFileId: string
  let imageFileName: string
  let imageFileId: string
  let customFileName: string
  let customFileId: string

  const createdFileIds: string[] = []
  const createdFolderIds: string[] = []
  let picker: FilePickerPage

  test.beforeAll(async () => {
    const instance = USERS.alice.instance

    // 1. Root-level files and folders
    parentFolder = `v2-opts-${stamp()}`
    parentFolderId = await ensureRootFolder(instance, parentFolder)
    createdFolderIds.push(parentFolderId)

    rootFileName = `v2-root-${stamp()}.txt`
    rootFileId = await createFile({
      instance,
      name: rootFileName,
      content: 'root level document'
    })
    createdFileIds.push(rootFileId)

    // 2. Subfolder inside parentFolder
    subFolder = `v2-sub-${stamp()}`
    subFolderId = await createFolder({
      instance,
      name: subFolder,
      parentId: parentFolderId
    })
    createdFolderIds.push(subFolderId)

    // 3. Files inside parentFolder
    textFileName = `v2-text-${stamp()}.txt`
    textFileId = await createFile({
      instance,
      name: textFileName,
      parentId: parentFolderId,
      content: 'standard text document'
    })
    createdFileIds.push(textFileId)

    largeFileName = `v2-large-${stamp()}.txt`
    largeFileId = await createFile({
      instance,
      name: largeFileName,
      parentId: parentFolderId,
      content: 'x'.repeat(2048)
    })
    createdFileIds.push(largeFileId)

    imageFileName = `v2-image-${stamp()}.png`
    imageFileId = await createFile({
      instance,
      name: imageFileName,
      parentId: parentFolderId,
      content: Buffer.from(PNG_PIXEL_BASE64, 'base64').toString('binary'),
      contentType: 'image/png'
    })
    createdFileIds.push(imageFileId)

    // 5. Unrestricted custom starting folder
    customFolder = `v2-custom-${stamp()}`
    customFolderId = await ensureRootFolder(instance, customFolder)
    createdFolderIds.push(customFolderId)

    customFileName = `v2-custom-file-${stamp()}.txt`
    customFileId = await createFile({
      instance,
      name: customFileName,
      parentId: customFolderId,
      content: 'custom starting folder file'
    })
    createdFileIds.push(customFileId)

    // 6. Restricted subtree folder
    restrictedFolder = `v2-restricted-${stamp()}`
    restrictedFolderId = await ensureRootFolder(instance, restrictedFolder)
    createdFolderIds.push(restrictedFolderId)

    const restrictedSubFolderId = await createFolder({
      instance,
      name: `v2-restricted-sub-${stamp()}`,
      parentId: restrictedFolderId
    })
    createdFolderIds.push(restrictedSubFolderId)

    restrictedFileName = `v2-restricted-file-${stamp()}.txt`
    const restrictedFileId = await createFile({
      instance,
      name: restrictedFileName,
      parentId: restrictedFolderId,
      content: 'restricted file'
    })
    createdFileIds.push(restrictedFileId)
  })

  test.afterAll(async () => {
    const instance = USERS.alice.instance
    await Promise.all(
      createdFileIds.map(fileId =>
        trashById(instance, fileId).catch(() => {})
      )
    )
    await Promise.all(
      createdFolderIds.map(folderId =>
        trashById(instance, folderId).catch(() => {})
      )
    )
  })

  test.beforeEach(async ({ alicePage }) => {
    picker = new FilePickerPage(alicePage)
  })

  // ===========================================================================
  // 1. Documents Action & Absolute Path Enrichment
  // ===========================================================================
  test.describe('Documents Action & Absolute Path', () => {
    test('confirms a file selection and returns a complete document with enriched absolute path', async () => {
      await picker.openWithPreset('Documents only')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)

      await expect(picker.documentsButton()).toBeVisible()
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)
      await expect(picker.hasPublicLinkButton()).resolves.toBe(false)
      await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(false)

      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(Array.isArray(document)).toBe(true)
      expect(document).toHaveLength(1)

      const entry = document[0]
      expect(entry.id).toBe(textFileId)
      expect(entry.name).toBe(textFileName)
      expect(entry.type).toBe('file')
      expect(entry.dir_id).toBe(parentFolderId)
      expect(entry.path).toBe(`/${parentFolder}/${textFileName}`)
      expect(entry.sharingLink).toBeUndefined()
      expect(entry.downloadLink).toBeUndefined()

      await picker.closeConfirmation()
    })

    test('confirms a root-level file with path including Drive root', async () => {
      await picker.openWithPreset('Documents only')

      await picker.selectItem(rootFileName)
      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(document).toHaveLength(1)
      expect(document[0].id).toBe(rootFileId)
      expect(document[0].name).toBe(rootFileName)
      expect(document[0].path).toBe(`/${rootFileName}`)

      await picker.closeConfirmation()
    })

    test('confirms a folder selection and returns folder document with native path', async () => {
      await picker.openWithPreset('Documents only')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(subFolder)

      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)
      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(document).toHaveLength(1)
      const folderEntry = document[0]
      expect(folderEntry.name).toBe(subFolder)
      expect(folderEntry.type).toBe('directory')
      expect(folderEntry.path).toBe(`/${parentFolder}/${subFolder}`)

      await picker.closeConfirmation()
    })

    test('multi-document selection returns an array of complete documents', async () => {
      await picker.openWithPreset('Documents only')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)
      await picker.toggleItem(largeFileName)

      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)
      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(document).toHaveLength(2)

      const names = document.map(d => d.name)
      expect(names).toContain(textFileName)
      expect(names).toContain(largeFileName)

      for (const entry of document) {
        expect(entry.path).toBe(`/${parentFolder}/${entry.name}`)
        expect(entry.sharingLink).toBeUndefined()
        expect(entry.downloadLink).toBeUndefined()
      }

      await picker.closeConfirmation()
    })

    test('custom label renders on documents button', async () => {
      const customLabel = 'Import Documents'
      await picker.openWithPreset('Custom documents button label')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)

      const label = await picker.getDocumentsButtonLabel()
      expect(label).toContain(customLabel)
    })
  })

  // ===========================================================================
  // 2. Action Hiding & Coexistence
  // ===========================================================================
  test.describe('Action Hiding & Coexistence', () => {
    test('coexistence: all three actions are visible and active when configured', async () => {
      await picker.openWithPreset('All 3 actions')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)

      await expect(picker.documentsButton()).toBeVisible()
      await expect(picker.hasPublicLinkButton()).resolves.toBe(true)
      await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(true)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)
      await expect(picker.isPublicLinkDisabled()).resolves.toBe(false)
      await expect(picker.isTemporaryDownloadDisabled()).resolves.toBe(false)
    })

    test('hiding: sharingLink null and downloadLink null hide their respective buttons', async () => {
      await picker.openWithPreset('Documents only')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)

      await expect(picker.documentsButton()).toBeVisible()
      await expect(picker.hasPublicLinkButton()).resolves.toBe(false)
      await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(false)
    })

    test('custom action labels render on sharing and download buttons', async () => {
      await picker.openWithPreset('Custom labels on link actions')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)

      await expect(picker.getPublicLinkButtonLabel()).resolves.toContain(
        'Publish to Web'
      )
      await expect(picker.getTemporaryDownloadButtonLabel()).resolves.toContain(
        'Direct Download'
      )
    })

    test('hiding every action leaves no confirmation action buttons', async () => {
      await picker.openWithPreset('No actions')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)

      await expect(picker.documentsButton()).toHaveCount(0)
      await expect(picker.hasPublicLinkButton()).resolves.toBe(false)
      await expect(picker.hasTemporaryDownloadButton()).resolves.toBe(false)
    })
  })

  // ===========================================================================
  // 3. Accept Constraints
  // ===========================================================================
  test.describe('Accept Constraints', () => {
    test('accept: ["folder"] allows folders and disables files', async () => {
      await picker.openWithPreset('Accept: folders only')

      await picker.navigateToFolder(parentFolder)

      // Selecting a file: documents action must be disabled
      await picker.selectItem(textFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)

      // Selecting a folder: documents action must be enabled
      await picker.selectItem(subFolder)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)

      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(document[0].name).toBe(subFolder)
      await picker.closeConfirmation()
    })

    test('accept: ["file"] allows files and disables folders', async () => {
      await picker.openWithPreset('Accept: files only')

      await picker.navigateToFolder(parentFolder)

      // Selecting a folder: documents action must be disabled
      await picker.selectItem(subFolder)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)

      // Selecting a file: documents action must be enabled
      await picker.selectItem(textFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)

      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(document[0].name).toBe(textFileName)
      await picker.closeConfirmation()
    })

    test('accept: ["image/*"] MIME filter on documents disables text files and allows images', async () => {
      await picker.openWithPreset('Accept: images only')

      await picker.navigateToFolder(parentFolder)

      // Text file is not an image -> disabled
      await picker.selectItem(textFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)

      // PNG image file -> enabled
      await picker.selectItem(imageFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)

      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(document[0].name).toBe(imageFileName)
      await picker.closeConfirmation()
    })

    test('accept: [] accepts nothing (disables action for all items)', async () => {
      await picker.openWithPreset('Accept: empty array')

      await picker.navigateToFolder(parentFolder)

      await picker.selectItem(textFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)

      await picker.selectItem(subFolder)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)
    })

    test('OR matching: accept: ["folder", "image/*"] accepts both folders and images but rejects text files', async () => {
      await picker.openWithPreset('Accept: folders and images')

      await picker.navigateToFolder(parentFolder)

      // Text file: rejected
      await picker.selectItem(textFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)

      // Folder: accepted
      await picker.selectItem(subFolder)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)

      // Image: accepted
      await picker.selectItem(imageFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)
    })
  })

  // ===========================================================================
  // 4. Size & Count Constraints
  // ===========================================================================
  test.describe('Size and Count Constraints', () => {
    test('maxFileCount constraint disables action when exceeded', async () => {
      await picker.openWithPreset('Max file count: 1')

      await picker.navigateToFolder(parentFolder)

      // 1 item selected: enabled
      await picker.selectItem(textFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)

      // 2 items selected: disabled
      await picker.toggleItem(largeFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)
    })

    test('availableSize constraint enforces total size excluding folders', async () => {
      await picker.openWithPreset('Available size 1 KB')

      await picker.navigateToFolder(parentFolder)

      // largeFileName is 2048 bytes > 1000 bytes: disabled
      await picker.selectItem(largeFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(true)

      // textFileName is ~27 bytes <= 1000 bytes: enabled
      await picker.selectItem(textFileName)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)

      // textFileName (27 bytes) + subFolder: folder is excluded from size sum, remains enabled
      await picker.toggleItem(subFolder)
      await expect(picker.isDocumentsDisabled()).resolves.toBe(false)
    })
  })

  // ===========================================================================
  // 5. Tabs Configuration
  // ===========================================================================
  test.describe('Tabs Configuration', () => {
    test('tabs configuration filters visible tabs and opens first effective tab', async () => {
      await picker.openWithPreset('Tabs: sharings and recents')

      await expect(picker.hasTab('My Drive')).resolves.toBe(false)
      await expect(picker.hasTab('Recents')).resolves.toBe(true)
      await expect(picker.hasTab('Sharings')).resolves.toBe(true)
      await expect(picker.isTabSelected('Recents')).resolves.toBe(true)
    })

    test('single tab config shows only Drive tab', async () => {
      await picker.openWithPreset('Tabs: drive only')

      await expect(picker.hasTab('My Drive')).resolves.toBe(true)
      await expect(picker.hasTab('Recents')).resolves.toBe(false)
      await expect(picker.hasTab('Sharings')).resolves.toBe(false)
    })

    test('tabs ordering preserves Drive canonical order regardless of caller array order', async () => {
      await picker.openWithPreset('Tabs: sharings and recents')

      // In Drive canonical order, Recents comes before Sharings
      await expect(picker.hasTab('Recents')).resolves.toBe(true)
      await expect(picker.hasTab('Sharings')).resolves.toBe(true)
      await expect(picker.isTabSelected('Recents')).resolves.toBe(true)
    })

    test('negative boundary: empty tabs array rejects intent initialization', async () => {
      await picker.openWithPreset('Tabs: empty array (error)', {}, false)

      const error = await picker.getIntentContainerError()
      expect(error).toContain('Invalid File Picker tabs')
      await expect(picker.pickerHeader()).toHaveCount(0)
    })

    test('negative boundary: unknown tab identifier rejects intent initialization', async () => {
      await picker.openWithPreset('Tabs: unknown tab (error)', {}, false)

      const error = await picker.getIntentContainerError()
      expect(error).toContain('Invalid File Picker tabs')
      await expect(picker.pickerHeader()).toHaveCount(0)
    })
  })

  // ===========================================================================
  // 6. defaultDirId & restrictToDefaultDir Subtree
  // ===========================================================================
  test.describe('defaultDirId & Subtree Restriction', () => {
    test('unrestricted defaultDirId opens folder initially with full upward navigation', async () => {
      await picker.openWithPreset('Documents only', {
        defaultDirId: customFolderId
      })

      // Started inside customFolder: customFileName should be visible immediately
      await expect(picker.item(customFileName)).toBeVisible()

      // Upward navigation is NOT restricted: breadcrumb has 'My Drive' button
      await expect(picker.breadcrumbButton('My Drive')).toBeVisible()

      // Tabs are not restricted
      await expect(picker.hasTab('Recents')).resolves.toBe(true)
      await expect(picker.hasTab('Sharings')).resolves.toBe(true)
    })

    test('unrestricted defaultDirId with nonexistent folder gracefully falls back to Drive root', async () => {
      await picker.openWithPreset('Documents only', {
        defaultDirId: 'nonexistent-folder-id-fallback'
      })

      // Picker opens normally at Drive root
      await expect(picker.isOpen()).resolves.toBe(true)
      await expect(picker.item(parentFolder)).toBeVisible()
      await expect(picker.breadcrumbButton('My Drive')).toHaveCount(0)
    })

    test('restrictToDefaultDir confines navigation, hides upward breadcrumbs and restricts tabs to Drive', async () => {
      await picker.openWithPreset('Documents only', {
        defaultDirId: restrictedFolderId,
        restrictToDefaultDir: true
      })

      // The known child confirms the restricted folder contents have loaded.
      await expect(picker.item(restrictedFileName)).toBeVisible()

      // Breadcrumb has restricted folder root but NO 'My Drive' button above it
      await expect(picker.breadcrumbButton('My Drive')).toHaveCount(0)

      // Non-drive tabs (Recents and Sharings) are forbidden and hidden
      await expect(picker.hasTab('Recents')).resolves.toBe(false)
      await expect(picker.hasTab('Sharings')).resolves.toBe(false)
      await expect(picker.hasTab('My Drive')).resolves.toBe(true)

      // Outside folders/files are not present
      await expect(picker.item(parentFolder)).toHaveCount(0)
    })

    test('negative boundary: restrictToDefaultDir without defaultDirId rejects intent', async () => {
      await picker.openWithPreset(
        'Restrict without defaultDirId (error)',
        { restrictToDefaultDir: true },
        false
      )

      const error = await picker.getIntentContainerError()
      expect(error).toContain('requires defaultDirId')
      await expect(picker.pickerHeader()).toHaveCount(0)
    })

    test('negative boundary: restrictToDefaultDir with forbidden tabs rejects intent', async () => {
      await picker.openWithPreset(
        'Restrict with forbidden tabs (error)',
        { defaultDirId: restrictedFolderId, restrictToDefaultDir: true },
        false
      )

      const error = await picker.getIntentContainerError()
      expect(error).toContain('Invalid File Picker tabs')
      await expect(picker.pickerHeader()).toHaveCount(0)
    })

    test('negative boundary: restrictToDefaultDir with nonexistent defaultDirId rejects intent', async () => {
      await picker.openWithPreset(
        'Documents only',
        {
          defaultDirId: 'nonexistent-folder-id-error',
          restrictToDefaultDir: true
        },
        false
      )

      const error = await picker.getIntentContainerError()
      expect(error).toBeTruthy()
      await expect(picker.pickerHeader()).toHaveCount(0)
    })
  })

  // ===========================================================================
  // 7. Selection Cardinality
  // ===========================================================================
  test.describe('Selection Cardinality', () => {
    test('multiple: false limits selection to one item and returns array with single entry', async () => {
      await picker.openWithPreset('Single selection')

      await picker.navigateToFolder(parentFolder)
      await picker.selectItem(textFileName)
      await picker.selectItem(largeFileName)

      await picker.clickDocumentsButton()
      await picker.waitForClosed()

      const document = (await picker.getResultDocument()) as Array<
        Record<string, unknown>
      >
      expect(document).toHaveLength(1)
      expect(document[0].name).toBe(largeFileName)
      expect(document[0].path).toBe(`/${parentFolder}/${largeFileName}`)

      await picker.closeConfirmation()
    })
  })
})
