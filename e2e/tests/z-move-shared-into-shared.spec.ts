import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  waitForSharingRow
} from '../helpers/sharing'
import { fetchFileMetadataByPath } from '../helpers/stack'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const MOVED = `Shared moved ${stamp()}`
const TARGET = `Shared target ${stamp()}`
const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`

const statusOf = async (path: string): Promise<number> =>
  (await fetchFileMetadataByPath({ instance: USERS.alice.instance, path }))
    .status

test.describe.serial('Move a shared folder into another shared folder', () => {
  test('Alice shares two folders with Bob', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, MOVED)
    await createAndShareFolderWithBob(alicePage, aliceDrive, TARGET)
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, MOVED)
  })

  test('Cancel move leaves the folder where it was', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const moveTo = await aliceDrive.row(MOVED).openMoveTo()
    await moveTo.openFolder(TARGET)
    await moveTo.answerSharedFolderInsideAnother('cancel')
    await moveTo.close()

    expect(await statusOf(`/${MOVED}`)).toBe(200)
    expect(await statusOf(`/${TARGET}/${MOVED}`)).toBe(404)
  })

  test('Stop sharing moves the folder and ends its own sharing', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const moveTo = await aliceDrive.row(MOVED).openMoveTo()
    await moveTo.openFolder(TARGET)
    await moveTo.answerSharedFolderInsideAnother('stopSharing')

    await expect.poll(() => statusOf(`/${TARGET}/${MOVED}`)).toBe(200)
    // Bob no longer has it as a sharing of its own
    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)
      await bobDrive.row(TARGET).waitVisible({ timeout: 5_000 })
      await expect(bobDrive.row(MOVED).cell).toHaveCount(0)
    }).toPass({ timeout: 30_000 })
  })
})
