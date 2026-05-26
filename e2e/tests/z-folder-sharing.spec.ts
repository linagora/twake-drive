import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { ShareModalPage } from '../pages/ShareModalPage'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const FOLDER_NAME = `Shared Folder ${stamp()}`

test.describe.serial('Folder sharing', () => {
  test('Alice creates a folder, enters it, and shares it with Bob', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)

    await aliceDrive.createFolder(FOLDER_NAME)
    await aliceDrive.row(FOLDER_NAME).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)

    await alicePage.getByRole('button', { name: /share/i }).click()

    const shareModal = new ShareModalPage(alicePage)
    await shareModal.waitForOpen()
    await shareModal.addMember(USERS.bob.email)
    await shareModal.share()
  })

  test('Bob sees the shared folder in his Sharings section', async ({
    bobPage,
    bobDrive
  }) => {
    await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)

    // Sharing propagates asynchronously across instances; reload until it lands.
    await expect(async () => {
      await bobPage.reload()
      await bobDrive.row(FOLDER_NAME).waitVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
  })
})
