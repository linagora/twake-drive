import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { t } from '../helpers/i18n'
import {
  createAndShareFolderWithBob,
  openSharedDrive,
  waitForSharingRow
} from '../helpers/sharing'
import { createFile } from '../helpers/stack'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const DRIVE_NAME = `Rename hidden ${stamp()}`
const FILE_NAME = `rename-hidden-${stamp()}.txt`

test.describe.serial('Rename of a shared drive (recipient)', () => {
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

  test('Bob cannot rename the drive from his Sharings, only what is inside', async ({
    bobPage,
    bobDrive
  }) => {
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    const driveItems = await bobDrive.row(DRIVE_NAME).menuItems()
    expect(driveItems).not.toContain(t('SelectionBar.rename'))

    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    const fileItems = await bobDrive.row(FILE_NAME).menuItems()
    expect(fileItems).toContain(t('SelectionBar.rename'))
  })
})
