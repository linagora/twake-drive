import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { createAndShareFolderWithBob } from '../helpers/sharing'

const PARENT_FOLDER = `Parent Folder ${stamp()}`
const NESTED_FOLDER = `Nested Folder ${stamp()}`

test.describe.serial('Nested folder role bug linagora/twake-drive#4200', () => {
  test('Alice creates parent and nested folder, shares parent with Bob as Viewer', async ({
    alicePage,
    aliceDrive
  }) => {
    // 1. Alice creates parent folder
    // 2. Alice creates nested folder within parent
    // 3. Alice shares parent with Bob as a viewer
    await createAndShareFolderWithBob(alicePage, aliceDrive, PARENT_FOLDER, {
      role: 'Viewer',
      seed: async () => {
        await aliceDrive.createFolder(NESTED_FOLDER)
        await aliceDrive.row(NESTED_FOLDER).waitVisible()
      }
    })
  })

  test('Alice changes Bob role on nested from Viewer to Editor, parent role should remain Viewer', async ({
    alicePage,
    aliceDrive
  }) => {
    // Navigate inside parent folder
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.openFolder(PARENT_FOLDER)
    await aliceDrive.row(NESTED_FOLDER).waitVisible()

    // Open share modal on nested folder
    const modal = await aliceDrive.row(NESTED_FOLDER).share()
    await expect(modal.memberItem('bob')).toContainText(/viewer/i)

    // Alice changes Bob's role on nested from viewer to editor
    await modal.setMemberRole('bob', 'Editor')
    await expect(modal.memberItem('bob')).toContainText(/editor/i)
    await modal.close()

    // Now check Alice's parent folder share modal
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    const parentModal = await aliceDrive.row(PARENT_FOLDER).share()

    // In issue linagora/twake-drive#4200:
    // Expected: Bob is viewer on parent
    // Actual (bug): Bob is editor on both parent and nested
    await expect(parentModal.memberItem('bob')).toContainText(/viewer/i)
    await parentModal.close()
  })
})
