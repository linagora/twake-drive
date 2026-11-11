import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  fetchFileMetadataByPath
} from '../helpers/stack'
import { SidebarPage } from '../pages/SidebarPage'

const ALICE = USERS.alice

test.describe('Cut and paste', () => {
  test('moves the selected file into another folder with Ctrl+X then Ctrl+V', async ({
    alicePage,
    aliceDrive
  }) => {
    const source = `Cut source ${stamp()}`
    const destination = `Cut destination ${stamp()}`
    const sourceId = await createFolder({
      instance: ALICE.instance,
      name: source
    })
    await createFolder({ instance: ALICE.instance, name: destination })
    const name = `cut-${stamp()}.txt`
    await createFile({
      instance: ALICE.instance,
      name,
      content: name,
      parentId: sourceId
    })

    await alicePage.goto(`${ALICE.appUrl}/#/folder/${sourceId}`)
    await aliceDrive.row(name).select()
    await aliceDrive.cutSelection()
    await expect(aliceDrive.row(name).cell).toBeVisible()

    // The clipboard lives in the app: reach the destination without a reload
    await new SidebarPage(alicePage).goToMyDrive()
    await aliceDrive.openFolder(destination)
    await aliceDrive.paste()

    await expect(aliceDrive.row(name).cell).toBeVisible()
    const moved = await fetchFileMetadataByPath({
      instance: ALICE.instance,
      path: `/${destination}/${name}`
    })
    expect(moved.data?.attributes.name).toBe(name)
    const left = await fetchFileMetadataByPath({
      instance: ALICE.instance,
      path: `/${source}/${name}`
    })
    expect(left.status).toBe(404)
  })
})
