import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { ShareModalPage } from '../pages/ShareModalPage'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const SHARED_FOLDER_NAME = `Shared Folder ${stamp()}`
const FOLDER_INSIDE = `Inside Folder ${stamp()}`

test.describe.serial('Shared folder browsing', () => {
  test('Alice shares a folder and it shows up in her Sharings', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)

    await aliceDrive.createFolder(SHARED_FOLDER_NAME)
    await aliceDrive.row(SHARED_FOLDER_NAME).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)

    await alicePage.getByRole('button', { name: /share/i }).click()
    const shareModal = new ShareModalPage(alicePage)
    await shareModal.waitForOpen()
    await shareModal.addMember(USERS.bob.email)
    await shareModal.share()

    // Alice owns the share, so her row lives on the by-me tab.
    await alicePage.goto(`${USERS.alice.appUrl}/#/sharings?tab=by-me`)
    await expect(aliceDrive.row(SHARED_FOLDER_NAME).cell).toBeVisible({
      timeout: 15_000
    })
  })

  test('the share auto-accepts on Bob’s side', async ({
    bobPage,
    bobDrive
  }) => {
    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)
      await expect(bobDrive.row(SHARED_FOLDER_NAME).cell).toBeVisible({
        timeout: 5_000
      })
    }).toPass({ timeout: 30_000 })
  })

  test('Bob can browse content Alice puts inside the shared folder', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/sharings?tab=by-me`)
    await aliceDrive.row(SHARED_FOLDER_NAME).open()
    await expect(alicePage.getByText(SHARED_FOLDER_NAME).first()).toBeVisible()
    await aliceDrive.createFolder(FOLDER_INSIDE)

    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)
      await bobDrive.row(SHARED_FOLDER_NAME).open()
      await expect(bobPage.getByText(SHARED_FOLDER_NAME).first()).toBeVisible({
        timeout: 5_000
      })
      await bobDrive.row(FOLDER_INSIDE).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })
})
