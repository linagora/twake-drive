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

test('a visitor renames a file through an editable public link', async ({
  alicePage,
  aliceDrive,
  publicPage
}) => {
  const folder = `Public rename ${stamp()}`
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: folder
  })
  const name = `public-rename-${stamp()}.txt`
  const renamed = `public-renamed-${stamp()}.txt`
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
  await visitor.row(name).rename(renamed)

  await expect
    .poll(
      async () =>
        (
          await fetchFileMetadataByPath({
            instance: ALICE.instance,
            path: `/${folder}/${renamed}`
          })
        ).status
    )
    .toBe(200)
  const former = await fetchFileMetadataByPath({
    instance: ALICE.instance,
    path: `/${folder}/${name}`
  })
  expect(former.status).toBe(404)
})
