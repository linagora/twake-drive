import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { expect, safeUnlink, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import { trashByName } from '../helpers/stack'
import { FileViewerPage } from '../pages/FileViewerPage'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')
const DRIVE_NAME = `Move Drive ${stamp()}`
const DESTINATION = `Move destination ${stamp()}`
const MOVED_FILE = `move-success-${stamp()}.txt`
const CANCELLED_FILE = `move-cancel-${stamp()}.txt`

test.describe.serial('Move from a shared drive', () => {
  test.afterAll(async () => {
    await trashByName(USERS.bob.instance, DESTINATION)
    await trashByName(USERS.alice.instance, DRIVE_NAME)
  })

  test('moves a file from the viewer to My Drive and exits the viewer', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await bobPage.goto(`${USERS.bob.appUrl}/#/folder`)
    await bobDrive.createFolder(DESTINATION)

    const filePaths = [MOVED_FILE, CANCELLED_FILE].map(name =>
      path.join(FIXTURE_DIR, name)
    )
    try {
      await Promise.all(filePaths.map(filePath => copyFile(SAMPLE, filePath)))
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.uploadFiles(filePaths)
          await aliceDrive.row(MOVED_FILE).waitVisible()
          await aliceDrive.row(CANCELLED_FILE).waitVisible()
        }
      })
    } finally {
      await Promise.all(filePaths.map(filePath => safeUnlink(filePath)))
    }

    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(MOVED_FILE).open()
    const viewer = new FileViewerPage(bobPage)
    await viewer.waitForOpen()

    const moveTo = await viewer.openMoveTo()
    await viewer.expectFileName(MOVED_FILE)
    await expect(moveTo.breadcrumb).toHaveText('My Drive')
    await moveTo.openFolder(DESTINATION)
    await moveTo.clickMove()

    await moveTo.confirmMovingOutsideSharedFolder(DRIVE_NAME)

    await bobPage.waitForURL(
      url =>
        /\/shareddrive\/[^/]+\/[^/]+/.test(url.toString()) &&
        !/\/file\//.test(url.toString())
    )
    await bobDrive.row(MOVED_FILE).waitHidden()

    await bobPage.goto(`${USERS.bob.appUrl}/#/folder`)
    await bobDrive.openFolder(DESTINATION)
    await expect(bobDrive.row(MOVED_FILE).cell).toBeVisible()
  })

  test('keeps the viewer open when MoveTo is cancelled', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(CANCELLED_FILE).open()
    const viewer = new FileViewerPage(bobPage)
    await viewer.waitForOpen()
    const viewerUrl = bobPage.url()

    const moveTo = await viewer.openMoveTo()
    await moveTo.close()

    await expect(bobPage).toHaveURL(viewerUrl)
    await viewer.expectVisible()
  })
})
