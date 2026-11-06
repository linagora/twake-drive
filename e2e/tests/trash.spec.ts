import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createFile,
  fetchFileMetadataByPath,
  trashById
} from '../helpers/stack'
import { SidebarPage } from '../pages/SidebarPage'
import { TrashPage } from '../pages/TrashPage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`

const trashStatus = async (name: string): Promise<number> =>
  (
    await fetchFileMetadataByPath({
      instance: USERS.alice.instance,
      path: `/.cozy_trash/${name}`
    })
  ).status

const trashName = async (name: string): Promise<void> => {
  const fileId = await createFile({
    instance: USERS.alice.instance,
    name,
    content: name
  })
  await trashById(USERS.alice.instance, fileId)
}

test.describe('Bin', () => {
  test('deletes one item permanently and keeps the other', async ({
    alicePage,
    aliceDrive
  }) => {
    const gone = `gone-${stamp()}.txt`
    const kept = `kept-${stamp()}.txt`
    for (const name of [gone, kept]) {
      await trashName(name)
    }

    await alicePage.goto(ALICE_ROOT)
    await new SidebarPage(alicePage).goToTrash()
    await aliceDrive.row(gone).deletePermanently()
    await expect(aliceDrive.row(kept).cell).toBeVisible()

    await alicePage.reload()
    await expect(aliceDrive.row(kept).cell).toBeVisible()
    await expect(aliceDrive.row(gone).cell).toHaveCount(0)
    expect(await trashStatus(gone)).toBe(404)
    expect(await trashStatus(kept)).toBe(200)
  })

  test('empties the Bin', async ({ alicePage, aliceDrive }) => {
    const name = `trashed-${stamp()}.txt`
    await trashName(name)
    await alicePage.goto(ALICE_ROOT)
    await new SidebarPage(alicePage).goToTrash()
    await expect(aliceDrive.row(name).cell).toBeVisible()
    const trash = new TrashPage(alicePage)
    await trash.emptyTrash()
    await expect(trash.emptyState).toBeVisible()

    await alicePage.reload()
    await expect(trash.emptyState).toBeVisible()
    await expect.poll(() => trashStatus(name)).toBe(404)
  })
})
