import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  openSharedDrive,
  waitForSharingRow
} from '../helpers/sharing'
import { trashByName } from '../helpers/stack'
import { ShareModalPage } from '../pages/ShareModalPage'

const READER_DRIVE = `Reader Members Drive ${stamp()}`
const EDITOR_DRIVE = `Editor Members Drive ${stamp()}`

test.describe.serial('Recipient permissions & member controls', () => {
  test.afterAll(async () => {
    await trashByName(USERS.alice.instance, READER_DRIVE)
    await trashByName(USERS.alice.instance, EDITOR_DRIVE)
  })

  test('Alice shares a drive with Bob as Viewer and Charlie as Editor', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(READER_DRIVE)
    await aliceDrive.openFolder(READER_DRIVE)

    const folderUrl = alicePage.url()
    const modal = await aliceDrive.openShareModal()
    await modal.setNewMemberRole('Viewer')
    await modal.addMember(USERS.bob.email)
    await modal.share()

    await alicePage.goto(`${folderUrl}/share`)
    const modal2 = new ShareModalPage(alicePage)
    await modal2.waitForOpen()
    await modal2.setNewMemberRole('Editor')
    await modal2.addMember(USERS.charlie.email)
    await modal2.share()

    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      READER_DRIVE,
      'by-me'
    )
  })

  test('Reader (Bob) sees all members but cannot edit or remove other members', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, READER_DRIVE)

    const modal = await bobDrive.openShareFromToolbarRecipients()

    // 1. All members are visible to Reader
    const aliceItem = modal.memberItem(USERS.alice.email)
    const bobItem = modal.memberItem('You').or(modal.memberItem(USERS.bob.email))
    const charlieItem = modal.memberItem(USERS.charlie.email)

    await expect(aliceItem).toBeVisible()
    await expect(aliceItem).toContainText(/owner/i)

    await expect(bobItem).toBeVisible()
    await expect(bobItem).toContainText(/viewer/i)

    await expect(charlieItem).toBeVisible()
    await expect(charlieItem).toContainText(/editor/i)

    // 2. Reader cannot change role or remove other members
    await expect(modal.memberRole(USERS.alice.email)).toHaveCount(0)
    await expect(modal.memberRemoveButton(USERS.alice.email)).toHaveCount(0)

    await expect(modal.memberRole(USERS.charlie.email)).toHaveCount(0)
    await expect(modal.memberRemoveButton(USERS.charlie.email)).toHaveCount(0)

    await modal.close()
  })

  test('Alice shares an editor drive with Bob as Editor and Charlie as Editor', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(EDITOR_DRIVE)
    await aliceDrive.openFolder(EDITOR_DRIVE)

    const folderUrl = alicePage.url()
    const modal = await aliceDrive.openShareModal()
    await modal.setNewMemberRole('Editor')
    await modal.addMember(USERS.bob.email)
    await modal.share()

    await alicePage.goto(`${folderUrl}/share`)
    const modal2 = new ShareModalPage(alicePage)
    await modal2.waitForOpen()
    await modal2.setNewMemberRole('Editor')
    await modal2.addMember(USERS.charlie.email)
    await modal2.share()

    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      EDITOR_DRIVE,
      'by-me'
    )
  })

  test('Editor (Bob) can manage permissions of other members, but not Owner', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, EDITOR_DRIVE)

    // Bob has write access initially
    await expect(bobDrive.uploadButton).toBeEnabled()
    await expect(bobDrive.createButton).toBeEnabled()

    const modal = await bobDrive.openShareFromToolbarRecipients()

    // Bob CAN see role and remove controls for Charlie
    await expect(modal.memberItem(USERS.charlie.email)).toBeVisible()
    await expect(modal.memberRole(USERS.charlie.email)).toBeVisible()
    await expect(modal.memberRemoveButton(USERS.charlie.email)).toBeVisible()

    // Bob CANNOT change or remove Alice (Owner)
    await expect(modal.memberItem(USERS.alice.email)).toBeVisible()
    await expect(modal.memberRole(USERS.alice.email)).toHaveCount(0)
    await expect(modal.memberRemoveButton(USERS.alice.email)).toHaveCount(0)

    // Bob (You) CAN see role and remove controls for himself
    const bobSelf = modal.memberItem('You').or(modal.memberItem(USERS.bob.email))
    await expect(bobSelf).toBeVisible()
    const bobSelfRole = modal.memberRole('You').or(modal.memberRole(USERS.bob.email))
    await expect(bobSelfRole).toBeVisible()
    const bobSelfRemove = modal.memberRemoveButton('You').or(modal.memberRemoveButton(USERS.bob.email))
    await expect(bobSelfRemove).toBeVisible()

    await modal.close()
  })

  test('Editor (Bob) can leave the shared drive by removing himself', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, EDITOR_DRIVE)

    const modal = await bobDrive.openShareFromToolbarRecipients()

    // Bob clicks remove on himself ("You")
    await modal.memberRemoveButton('You').click()

    // The modal indicates the sharing has been cancelled for Bob
    await expect(modal.dialog).toContainText(/cancelled sharing/i)
    await modal.close()

    // Navigating back to Bob's sharings list
    await bobPage.goto(`${USERS.bob.appUrl}/#/sharings/with-me`)
    await expect(bobDrive.row(EDITOR_DRIVE).cell).toHaveCount(0)
  })
})
