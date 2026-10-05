import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { createAndShareFolderWithBob } from '../helpers/sharing'
import { trashByName } from '../helpers/stack'

const PARENT_FOLDER = `Parent Folder ${stamp()}`
const NESTED_FOLDER = `Nested Folder ${stamp()}`

test.describe('Nested folder role bug linagora/twake-drive#4200', () => {
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
})
