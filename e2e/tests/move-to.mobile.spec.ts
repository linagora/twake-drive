import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { createFile, trashById, trashByName } from '../helpers/stack'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`

test.describe('MoveTo mobile', () => {
  test('moves an item into a folder from its action menu', async ({
    alicePage,
    aliceDrive
  }) => {
    const destination = `Mobile move destination ${stamp()}`
    const sourceFile = `Mobile move source ${stamp()}.txt`
    let sourceId: string | null = null

    try {
      sourceId = await createFile({
        instance: USERS.alice.instance,
        name: sourceFile,
        content: 'MoveTo mobile fixture'
      })
      await alicePage.goto(ALICE_ROOT)
      await aliceDrive.createFolder(destination)
      await aliceDrive.row(sourceFile).waitVisible()

      const moveTo = await aliceDrive.row(sourceFile).openMoveTo()
      await moveTo.openFolder(destination)
      await moveTo.confirm()

      await aliceDrive.row(sourceFile).waitHidden()
      await aliceDrive.openFolder(destination)
      await expect(aliceDrive.row(sourceFile).cell).toBeVisible()
    } finally {
      if (sourceId) await trashById(USERS.alice.instance, sourceId)
      await trashByName(USERS.alice.instance, destination)
    }
  })
})
