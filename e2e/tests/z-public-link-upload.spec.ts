import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { createEditableLink } from '../helpers/sharing'
import {
  createFile,
  createFolder,
  fetchFileMetadataByPath
} from '../helpers/stack'
import { PublicLinkPage } from '../pages/PublicLinkPage'

const ALICE = USERS.alice

test('a visitor uploads a file through an editable public link', async ({
  alicePage,
  aliceDrive,
  publicPage
}) => {
  const folder = `Public upload ${stamp()}`
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: folder
  })
  const name = `public-present-${stamp()}.txt`
  const uploaded = `public-uploaded-${stamp()}.txt`
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
  await visitor.uploadFiles({
    name: uploaded,
    mimeType: 'text/plain',
    buffer: Buffer.from(uploaded)
  })
  await expect(visitor.row(uploaded).cell).toBeVisible()

  await expect
    .poll(
      async () =>
        (
          await fetchFileMetadataByPath({
            instance: ALICE.instance,
            path: `/${folder}/${uploaded}`
          })
        ).status
    )
    .toBe(200)

  await alicePage.reload()
  await aliceDrive.row(uploaded).waitVisible()
})
