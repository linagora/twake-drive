import { USERS } from '../helpers/config'
import { escapeRegExp, expect, stamp, test } from '../helpers/fixtures'
import { createFolder } from '../helpers/stack'
import { SidebarPage } from '../pages/SidebarPage'

const ALICE = USERS.alice

test('sends the folder on display to the Bin and goes back to its parent', async ({
  alicePage,
  aliceDrive
}) => {
  const parentId = await createFolder({
    instance: ALICE.instance,
    name: `Trash parent ${stamp()}`
  })
  const name = `Trashed from toolbar ${stamp()}`
  const folderId = await createFolder({
    instance: ALICE.instance,
    name,
    parentId
  })

  await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
  await aliceDrive.waitForEmptyState()
  await aliceDrive.trashCurrentFolder()

  await alicePage.waitForURL(new RegExp(`#/folder/${escapeRegExp(parentId)}$`))
  await aliceDrive.waitForEmptyState()
  await new SidebarPage(alicePage).goToTrash()
  await expect(aliceDrive.row(name).cell).toBeVisible()
})
