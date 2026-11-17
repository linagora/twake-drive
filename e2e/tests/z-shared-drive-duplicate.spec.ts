import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'
import { createFile } from '../helpers/stack'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const DRIVE_NAME = `Duplicate drive ${stamp()}`
const FILE_NAME = `duplicate-${stamp()}.txt`
const STEM = FILE_NAME.replace(/\.txt$/, '')

test.describe.serial('Duplicate in a shared drive (recipient)', () => {
  test('Alice shares a drive holding a file with Bob as Editor', async ({
    alicePage,
    aliceDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
      seed: async () => {
        const folderId = new URL(alicePage.url()).hash.split('/').pop()
        if (!folderId) throw new Error(`No folder id for ${DRIVE_NAME}`)
        await createFile({
          instance: USERS.alice.instance,
          name: FILE_NAME,
          content: FILE_NAME,
          parentId: folderId
        })
      }
    })
  })

  test('Bob duplicates the file inside the drive and Alice gets the copy', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(FILE_NAME).duplicate()
    await expect(bobDrive.matching(STEM)).toHaveCount(2, { timeout: 10_000 })

    await expect(async () => {
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
      await expect(aliceDrive.matching(STEM)).toHaveCount(2, {
        timeout: 5_000
      })
    }).toPass({ timeout: 30_000 })
  })
})
