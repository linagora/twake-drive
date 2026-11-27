import { readFile } from 'fs/promises'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import {
  countFileVersions,
  createFile,
  overwriteFile,
  trashByName,
  waitForVersionWindow
} from '../helpers/stack'

const DRIVE_NAME = `Versions drive ${stamp()}`
const FILE_NAME = `drive-versioned-${stamp()}.txt`
const NEWEST_OLD_CONTENT = 'version 1'

let fileId = ''

/** The versions of a drive file live on the owner's instance: a member
 * reads, downloads and deletes them through the drive. */
test.describe.serial('Shared drive file versions (recipient)', () => {
  test.afterAll(async () => {
    await trashByName(USERS.alice.instance, DRIVE_NAME)
  })

  test('Alice shares a folder holding a file with two older versions', async ({
    alicePage,
    aliceDrive
  }) => {
    const instance = USERS.alice.instance
    await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
      seed: async () => {
        const folderId = new URL(alicePage.url()).hash.split('/').pop()
        if (!folderId) throw new Error(`No folder id for ${DRIVE_NAME}`)
        fileId = await createFile({
          instance,
          name: FILE_NAME,
          content: 'version 0',
          parentId: folderId
        })
        await overwriteFile({ instance, fileId, content: NEWEST_OLD_CONTENT })
        await waitForVersionWindow()
        await overwriteFile({ instance, fileId, content: 'version 2' })
      }
    })

    expect(await countFileVersions({ instance, fileId })).toBe(2)
  })

  test('Bob lists, downloads and deletes the older versions of a drive file', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    const row = bobDrive.row(FILE_NAME)
    await row.waitVisible({ timeout: 10_000 })

    const history = await row.openHistory()
    // The current version, then its two older versions
    await expect(history.downloadButtons).toHaveCount(3, { timeout: 15_000 })

    const download = await history.downloadVersion(0)
    expect(await readFile(await download.path(), 'utf8')).toBe(
      NEWEST_OLD_CONTENT
    )

    await history.deleteVersion(0)
    await expect(history.downloadButtons).toHaveCount(2)
    expect(
      await countFileVersions({ instance: USERS.alice.instance, fileId })
    ).toBe(1)
  })
})
