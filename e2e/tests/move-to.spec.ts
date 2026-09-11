import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { expect, safeUnlink, stamp, test } from '../helpers/fixtures'

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')
const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`

test.describe('MoveTo folder creation', () => {
  test('creates a destination folder inline and moves the source into it', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const folderName = `0AA-${stamp()}`
    let createdFolder: string | null = null
    const sourceFile = `Move source ${stamp()}.txt`
    const sourcePath = path.join(path.dirname(FIXTURE), sourceFile)
    await copyFile(FIXTURE, sourcePath)

    try {
      await aliceDrive.uploadFiles(sourcePath)
      await aliceDrive.row(sourceFile).waitVisible()

      const moveTo = await aliceDrive.row(sourceFile).openMoveTo()
      await expect(moveTo.createFolderButton).toBeVisible()
      await moveTo.showFolderCreation()

      await moveTo.creationInput.fill(folderName)
      await moveTo.creationInput.press('Enter')

      await expect(moveTo.creationForm).toBeHidden()
      createdFolder = folderName
      await expect(moveTo.breadcrumb).toHaveText('My Drive')
      await expect(moveTo.isFolderSelected(folderName)).resolves.toBe(false)

      await moveTo.openFolder(folderName)
      await expect(moveTo.moveButton).toBeEnabled()
      await moveTo.confirm()

      await aliceDrive.row(sourceFile).waitHidden()
      await aliceDrive.row(folderName).open()
      await alicePage.waitForURL(/\/folder\/[^/]+$/)
      await expect(aliceDrive.row(sourceFile).cell).toBeVisible()
    } finally {
      await alicePage.goto(ALICE_ROOT)
      if (createdFolder) {
        await aliceDrive.row(createdFolder).sendToTrash()
      }
      await safeUnlink(sourcePath)
    }
  })

  test('keeps the source visible but prevents selecting it as destination', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const moveTo = await aliceDrive.row('Administrative').openMoveTo()
    await moveTo.expectFolderDisabled('Administrative', /being moved/i)
    await moveTo.expectMoveDisabled()
    await moveTo.close()
  })
})
