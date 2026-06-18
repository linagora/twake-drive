import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, stamp, safeUnlink } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  waitForSharingRow
} from '../helpers/sharing'
import { FileViewerPage } from '../pages/FileViewerPage'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

const DRIVE_NAME = `ViewerAccess-${stamp()}`
const SUBFOLDER = `ViewerAccessSub-${stamp()}`
const FILE_NAME = `viewer-access-${stamp()}.txt`

test.describe('Viewer sharing access panel', () => {
  test('shows shared folder members for a file inside a subfolder', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, FILE_NAME)
    await copyFile(SAMPLE, filePath)

    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.createFolder(SUBFOLDER)
          await aliceDrive.row(SUBFOLDER).open()
          await alicePage.waitForURL(/\/folder\/[^/]+$/)
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(FILE_NAME).waitVisible()
          await alicePage.goBack()
          await aliceDrive.row(SUBFOLDER).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }

    await waitForSharingRow(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
    await aliceDrive.row(SUBFOLDER).open()
    await aliceDrive.row(FILE_NAME).waitVisible({ timeout: 10_000 })
    await aliceDrive.row(FILE_NAME).open()

    const viewer = new FileViewerPage(alicePage)
    await viewer.waitForOpen()
    await viewer.expectWhoHasAccessWith(['You', /bob/i])
  })
})
