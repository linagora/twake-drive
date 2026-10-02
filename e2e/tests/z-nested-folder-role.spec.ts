import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import { trashByName } from '../helpers/stack'

const PARENT_FOLDER = `Parent Folder ${stamp()}`
const NESTED_FOLDER = `Nested Folder ${stamp()}`

test.describe
  .serial('Nested folder role bug linagora/twake-drive#4200 and #4220', () => {
  test.afterAll(async () => {
    await trashByName(USERS.alice.instance, PARENT_FOLDER)
  })

  test('Alice changes Bob role on nested from Viewer to Editor without mutating parent role', async ({
    alicePage,
    aliceDrive
  }) => {
    // 1. Alice creates parent folder, seeds nested folder, and shares parent with Bob as Viewer
    await createAndShareFolderWithBob(alicePage, aliceDrive, PARENT_FOLDER, {
      role: 'Viewer',
      seed: async () => {
        await aliceDrive.createFolder(NESTED_FOLDER)
        await aliceDrive.row(NESTED_FOLDER).waitVisible()
      }
    })

    // Alice is already inside parent folder; wait for nested folder row
    await aliceDrive.row(NESTED_FOLDER).waitVisible()

    // 2. Open share modal on nested folder and verify Bob has Viewer role
    const modal = await aliceDrive.row(NESTED_FOLDER).share()
    await expect(modal.memberItem('bob')).toContainText(/viewer/i)

    // 3. Alice changes Bob's role on nested from Viewer to Editor
    await modal.setMemberRole('bob', 'Editor')
    await expect(modal.memberItem('bob')).toContainText(/editor/i)
    await modal.close()

    // 4. Verify Alice's parent folder share modal still has Bob as Viewer
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    const parentModal = await aliceDrive.row(PARENT_FOLDER).share()

    // In issue linagora/twake-drive#4200:
    // Expected: Bob remains Viewer on parent
    await expect(parentModal.memberItem('bob')).toContainText(/viewer/i)
    await parentModal.close()
  })

  test('Bob opens parent then navigates to nested: Bob has write access on nested (linagora/twake-drive#4220)', async ({
    bobPage,
    bobDrive
  }) => {
    // 1. Bob opens parent shared drive from Sharings
    await openSharedDrive(bobPage, USERS.bob, bobDrive, PARENT_FOLDER)

    // 2. In parent folder, Bob is Viewer -> Upload button is disabled
    await expect(
      bobPage.getByRole('button', { name: 'Upload', exact: true })
    ).toBeDisabled()
    await bobDrive.row(NESTED_FOLDER).waitVisible()

    // 3. Bob navigates into nested folder from parent
    await bobDrive.row(NESTED_FOLDER).open()
    await bobPage.waitForURL(/\/shareddrive\/[^/]+\/[^/]+/)

    // 4. In nested folder, Bob has Editor access -> Upload button is enabled
    await expect(
      bobPage.getByRole('button', { name: 'Upload', exact: true })
    ).toBeEnabled()

    // 5. Bob can create a folder inside nested
    const BOB_SUBFOLDER = `Bob Folder ${stamp()}`
    await bobDrive.createFolder(BOB_SUBFOLDER)
    await bobDrive.row(BOB_SUBFOLDER).waitVisible()
  })
})
