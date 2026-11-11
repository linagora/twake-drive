import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  fetchFileMetadataByPath
} from '../helpers/stack'

const ALICE = USERS.alice

test.describe('Undo a move', () => {
  test('Cancel in the success alert puts the file back where it was', async ({
    alicePage,
    aliceDrive
  }) => {
    const source = `Undo source ${stamp()}`
    const destination = `Undo destination ${stamp()}`
    const sourceId = await createFolder({
      instance: ALICE.instance,
      name: source
    })
    await createFolder({
      instance: ALICE.instance,
      name: destination,
      parentId: sourceId
    })
    const name = `undo-${stamp()}.txt`
    await createFile({
      instance: ALICE.instance,
      name,
      content: name,
      parentId: sourceId
    })

    await alicePage.goto(`${ALICE.appUrl}/#/folder/${sourceId}`)
    const moveTo = await aliceDrive.row(name).openMoveTo()
    await moveTo.openFolder(destination)
    await moveTo.confirm()
    await moveTo.expectSuccessNotification(name, destination)
    await aliceDrive.row(name).waitHidden()

    await moveTo.undoFromSuccessNotification(name, destination)

    await expect(aliceDrive.row(name).cell).toBeVisible()
    const back = await fetchFileMetadataByPath({
      instance: ALICE.instance,
      path: `/${source}/${name}`
    })
    expect(back.data?.attributes.name).toBe(name)
    const moved = await fetchFileMetadataByPath({
      instance: ALICE.instance,
      path: `/${source}/${destination}/${name}`
    })
    expect(moved.status).toBe(404)
  })
})
