import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { ShareModalPage } from '../pages/ShareModalPage'
import { SharedDriveModalPage } from '../pages/SharedDriveModalPage'
import { SharedDrivePage } from '../pages/SharedDrivePage'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const SHARED_DRIVE_NAME = `Shared Drive ${stamp()}`
const FOLDER_INSIDE = `Inside Folder ${stamp()}`

test.describe.serial('Shared Drives', () => {
  test('Alice creates a shared drive and it shows up in Sharings', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/sharings?tab=1`)
    const sharedDrive = new SharedDrivePage(alicePage)
    const modal = new SharedDriveModalPage(alicePage)

    await sharedDrive.clickCreate()
    await modal.waitForOpen()
    await modal.setName(SHARED_DRIVE_NAME)
    await modal.confirm()
    await modal.waitForClose()

    await expect(aliceDrive.row(SHARED_DRIVE_NAME).cell).toBeVisible({
      timeout: 15_000
    })
  })

  test('Alice invites Bob and the share auto-accepts on his side', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/sharings?tab=1`)
    await aliceDrive.row(SHARED_DRIVE_NAME).open()
    // Owner sees /folder/<id>; recipient sees /shareddrive/... — assert on
    // the breadcrumb instead of the URL so this works for both.
    await expect(alicePage.getByText(SHARED_DRIVE_NAME).first()).toBeVisible()

    await alicePage.getByRole('button', { name: /share/i }).click()
    const shareModal = new ShareModalPage(alicePage)
    await shareModal.waitForOpen()
    await shareModal.addMember(USERS.bob.email)
    await shareModal.share()

    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/sharings?tab=1`)
      await expect(bobDrive.row(SHARED_DRIVE_NAME).cell).toBeVisible({
        timeout: 5_000
      })
    }).toPass({ timeout: 30_000 })
  })

  test('Bob can browse content Alice puts inside the shared drive', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/sharings?tab=1`)
    await aliceDrive.row(SHARED_DRIVE_NAME).open()
    await expect(alicePage.getByText(SHARED_DRIVE_NAME).first()).toBeVisible()
    await aliceDrive.createFolder(FOLDER_INSIDE)

    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/sharings?tab=1`)
      await bobDrive.row(SHARED_DRIVE_NAME).open()
      await expect(bobPage.getByText(SHARED_DRIVE_NAME).first()).toBeVisible({
        timeout: 5_000
      })
      await bobDrive.row(FOLDER_INSIDE).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })
})
