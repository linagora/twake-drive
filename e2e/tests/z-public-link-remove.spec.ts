import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { createEditableLink } from '../helpers/sharing'
import {
  createFile,
  createFolder,
  fetchFileMetadataByPath
} from '../helpers/stack'
import { PublicLinkPage } from '../pages/PublicLinkPage'
import { SidebarPage } from '../pages/SidebarPage'

const ALICE = USERS.alice

test('a visitor removes a file through an editable public link', async ({
  alicePage,
  aliceDrive,
  publicPage
}) => {
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
  const url = await createEditableLink(alicePage, aliceDrive)

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
  await new SidebarPage(alicePage).goToTrash()
  await expect(aliceDrive.row(name).cell).toBeVisible()
})
