import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { createFile, createFolder } from '../helpers/stack'
import { SidebarPage } from '../pages/SidebarPage'

const ALICE = USERS.alice

test.describe('Delete key', () => {
  test('sends the selected file to the Bin once confirmed', async ({
    alicePage,
    aliceDrive
  }) => {
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: `Delete key ${stamp()}`
    })
    const trashed = `delete-key-${stamp()}.txt`
    const kept = `delete-key-kept-${stamp()}.txt`
    for (const name of [trashed, kept]) {
      await createFile({
        instance: ALICE.instance,
        name,
        content: name,
        parentId: folderId
      })
    }

    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row(trashed).select()
    await aliceDrive.trashSelectionWithDeleteKey()

    await aliceDrive.row(trashed).waitHidden()
    await expect(aliceDrive.row(kept).cell).toBeVisible()

    await new SidebarPage(alicePage).goToTrash()
    await expect(aliceDrive.row(trashed).cell).toBeVisible()
  })
})
