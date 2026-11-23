import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import {
  test,
  expect,
  stamp,
  safeUnlink,
  escapeRegExp
} from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import { FileViewerPage } from '../pages/FileViewerPage'
import { SidebarPage } from '../pages/SidebarPage'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

const DRIVE_PREFIX = 'RecentDrive'
const DRIVE_NAME = `${DRIVE_PREFIX}-${stamp()}`
const SHARED_FILE_NAME = `recent-shared-${stamp()}.txt`
const BOB_DRIVE_FILE_NAME = `recent-bob-drive-${stamp()}.txt`
const BOB_LOCAL_FILE_NAME = `recent-bob-local-${stamp()}.txt`
test.describe.serial('Shared drive files in Recents (recipient)', () => {
  test('Alice shares a folder containing a file with Bob', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, SHARED_FILE_NAME)
    await copyFile(SAMPLE, filePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(SHARED_FILE_NAME).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('Bob sees the federated shared file in Recents via dataproxy and can open it', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(SHARED_FILE_NAME).waitVisible({ timeout: 10_000 })

    const sidebar = new SidebarPage(bobPage)
    await sidebar.goToRecent()
    await bobPage.waitForURL(/\/recent/)

    await bobDrive.row(SHARED_FILE_NAME).waitVisible({ timeout: 25_000 })

    const viewer = new FileViewerPage(bobPage)
    const [proxiedDownload] = await Promise.all([
      bobPage.waitForResponse(
        res => /\/sharings\/drives\/[^/]+\/downloads/.test(res.url()),
        { timeout: 20_000 }
      ),
      bobDrive.row(SHARED_FILE_NAME).open()
    ])
    expect(proxiedDownload.ok()).toBeTruthy()

    await viewer.waitForOpen()
    await bobPage.waitForURL(/\/shareddrive\/[^/]+\/[^/]+\/file\/[^/]+/)
    await expect(bobPage).toHaveTitle(
      new RegExp(escapeRegExp(SHARED_FILE_NAME)),
      { timeout: 15_000 }
    )
  })

  test('With the personal recents, Bob goes from a local recent to a shared drive one in the viewer', async ({
    bobPage,
    bobDrive
  }) => {
    setFlags(USERS.bob.instance, {
      ...DEFAULT_FLAGS,
      'drive.recents.enabled': true
    })
    const driveFilePath = path.join(FIXTURE_DIR, BOB_DRIVE_FILE_NAME)
    const localFilePath = path.join(FIXTURE_DIR, BOB_LOCAL_FILE_NAME)
    await copyFile(SAMPLE, driveFilePath)
    await copyFile(SAMPLE, localFilePath)
    try {
      // The personal recents only hold Bob's own activity, not Alice's. The
      // stack records none for the CLI token of createFile: upload in the UI.
      await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
      await bobDrive.uploadFiles(driveFilePath)
      await bobDrive.row(BOB_DRIVE_FILE_NAME).waitVisible()

      const sidebar = new SidebarPage(bobPage)
      await sidebar.goToMyDrive()
      await bobDrive.uploadFiles(localFilePath)
      await bobDrive.row(BOB_LOCAL_FILE_NAME).waitVisible()

      await sidebar.goToRecent()
      await bobPage.waitForURL(/\/recent/)
      await bobDrive.row(BOB_DRIVE_FILE_NAME).waitVisible({ timeout: 25_000 })
      await bobDrive.row(BOB_LOCAL_FILE_NAME).open()

      const viewer = new FileViewerPage(bobPage)
      await viewer.waitForOpen()
      await viewer.expectFileName(BOB_LOCAL_FILE_NAME)

      // Last activity first: the drive file comes right after the local one
      await viewer.next()
      await viewer.expectFileName(BOB_DRIVE_FILE_NAME)
      expect(bobPage.url()).toMatch(/#\/recent\/file\/[^/]+$/)
    } finally {
      setFlags(USERS.bob.instance, {
        ...DEFAULT_FLAGS,
        'drive.recents.enabled': false
      })
      await safeUnlink(driveFilePath)
      await safeUnlink(localFilePath)
    }
  })
})
