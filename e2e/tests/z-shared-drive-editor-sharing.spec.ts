import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, stamp, safeUnlink } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import { EditorTitleBarPage } from '../pages/EditorTitleBarPage'
import { ShareModalPage } from '../pages/ShareModalPage'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'drawing.excalidraw')

const DRIVE_NAME = `EditorShare-${stamp()}`
const FILE_NAME = `editor-share-${stamp()}.excalidraw`

// Excalidraw is the only editor the suite can drive end to end: it needs no
// external server, unlike OnlyOffice, and lives in Drive, unlike Notes.
const EXCALIDRAW_FLAGS = { ...DEFAULT_FLAGS, 'drive.excalidraw.enabled': true }

// A shared drive file is edited on its owner's public Drive page, where the
// recipient's sharecode cannot manage the sharing: the title bar must send
// them to the share modal of their own Drive, and link home and back.
test.describe.serial('Shared drive editor title bar (recipient)', () => {
  test.beforeAll(() => {
    setFlags(USERS.alice.instance, EXCALIDRAW_FLAGS)
    setFlags(USERS.bob.instance, EXCALIDRAW_FLAGS)
  })
  test.afterAll(() => {
    setFlags(USERS.alice.instance, DEFAULT_FLAGS)
    setFlags(USERS.bob.instance, DEFAULT_FLAGS)
  })

  test('Alice shares a folder containing a drawing', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, FILE_NAME)
    await copyFile(SAMPLE, filePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(FILE_NAME).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('Bob edits the drawing on the owner instance and shares it from his own Drive', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(FILE_NAME).waitVisible({ timeout: 10_000 })
    await bobDrive.row(FILE_NAME).open()

    await bobPage.waitForURL(
      url =>
        url.href.startsWith(`${USERS.alice.appUrl}/public/`) &&
        url.searchParams.has('redirectLink') &&
        url.searchParams.has('shareUrl'),
      { timeout: 20_000 }
    )

    const titleBar = new EditorTitleBarPage(bobPage)
    await titleBar.waitForOpen()
    await titleBar.expectHomeLinkTo(USERS.bob.instance)
    await titleBar.expectBackButton()
    await titleBar.share()

    await bobPage.waitForURL(
      /\/sharings\/with-me\/shareddrive\/[^/]+\/[^/]+\/file\/[^/]+\/share$/,
      { timeout: 20_000 }
    )
    const modal = new ShareModalPage(bobPage)
    await modal.waitForOpen()
  })
})
