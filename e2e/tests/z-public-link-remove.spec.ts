import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  fetchFileMetadataByPath
} from '../helpers/stack'
import { PublicLinkPage } from '../pages/PublicLinkPage'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'
import { ShareModalPage } from '../pages/ShareModalPage'
import { SidebarPage } from '../pages/SidebarPage'

const ALICE = USERS.alice

test('a visitor removes a file through an editable public link', async ({
  alicePage,
  aliceDrive,
  publicPage
}) => {
  await alicePage
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'])
  const folder = `Public remove ${stamp()}`
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: folder
  })
  const name = `public-remove-${stamp()}.txt`
  await createFile({
    instance: ALICE.instance,
    name,
    content: name,
    parentId: folderId
  })

  await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
  await aliceDrive.row(name).waitVisible()
  await aliceDrive.openShareModal()
  const link = new ShareByLinkPage(alicePage)
  const url = await link.createLink()
  // The role of the link shows once the modal reads it again
  await new ShareModalPage(alicePage).dismiss()
  await aliceDrive.openShareModal()
  await link.waitForLinkRow()
  await link.allowEditing()

  const visitor = new PublicLinkPage(publicPage)
  await visitor.open(url)
  await visitor.row(name).sendToTrash()

  await expect
    .poll(
      async () =>
        (
          await fetchFileMetadataByPath({
            instance: ALICE.instance,
            path: `/${folder}/${name}`
          })
        ).status
    )
    .toBe(404)
  // In the Bin of the owner, not destroyed
  await new ShareModalPage(alicePage).dismiss()
  await new SidebarPage(alicePage).goToTrash()
  await expect(aliceDrive.row(name).cell).toBeVisible()
})
