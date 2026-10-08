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
const LEAVE_DRIVE = `Leave Members Drive ${stamp()}`
const NESTED_DRIVE = `Nested Editor Drive ${stamp()}`
const NESTED_CHILD = `Nested Child ${stamp()}`

test.describe.serial('Recipient permissions & member controls', () => {
  test.afterAll(async () => {
    await trashByName(USERS.alice.instance, READER_DRIVE)
    await trashByName(USERS.alice.instance, EDITOR_DRIVE)
    await trashByName(USERS.alice.instance, LEAVE_DRIVE)
    await trashByName(USERS.alice.instance, NESTED_DRIVE)
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

  test('Editor (Bob) downgrades himself to Viewer', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, EDITOR_DRIVE)

    // Bob starts with write access
    await expect(bobDrive.uploadButton).toBeEnabled()
    await expect(bobDrive.createButton).toBeEnabled()

    const modal = await bobDrive.openShareFromToolbarRecipients()
    await modal.setMemberRole('You', 'Viewer')

    // Upon self-downgrade to Viewer, the modal transitions to the read-only details modal
    await expect(modal.memberItem('You')).toContainText(/viewer/i)
    await expect(modal.memberRole('You')).toHaveCount(0)
    await expect(modal.memberRole(USERS.charlie.email)).toHaveCount(0)
    await modal.close()

    // Write access is immediately revoked
    await expect(bobDrive.uploadButton).toBeDisabled()
    await expect(bobDrive.createButton).toBeDisabled()

    // Permissions stay revoked after page reload
    await bobPage.reload()
    await expect(bobDrive.uploadButton).toBeDisabled()
    await expect(bobDrive.createButton).toBeDisabled()
  })

  test('Alice shares a drive with Bob as Editor so Bob can test leaving it', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(LEAVE_DRIVE)
    await aliceDrive.openFolder(LEAVE_DRIVE)

    const modal = await aliceDrive.openShareModal()
    await modal.setNewMemberRole('Editor')
    await modal.addMember(USERS.bob.email)
    await modal.share()

    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      LEAVE_DRIVE,
      'by-me'
    )
  })

  test('Editor (Bob) can leave the shared drive by removing himself', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, LEAVE_DRIVE)

    const modal = await bobDrive.openShareFromToolbarRecipients()

    // Bob clicks remove on himself ("You")
    await modal.memberRemoveButton('You').click()

    // The modal indicates the sharing has been cancelled for Bob
    await expect(modal.dialog).toContainText(/cancelled sharing/i)
    await modal.close()

    // Navigating back to Bob's sharings list
    await bobPage.goto(`${USERS.bob.appUrl}/#/sharings/with-me`)
    await expect(bobDrive.row(LEAVE_DRIVE).cell).toHaveCount(0)
  })

  test('Alice shares nested parent drive with Bob as Editor', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(NESTED_DRIVE)
    await aliceDrive.openFolder(NESTED_DRIVE)

    const modal = await aliceDrive.openShareModal()
    await modal.setNewMemberRole('Editor')
    await modal.addMember(USERS.bob.email)
    await modal.share()

    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      NESTED_DRIVE,
      'by-me'
    )
  })

  test('Editor (Bob) can add, downgrade, and remove a member on a nested sharing', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, NESTED_DRIVE)
    const parentDriveUrl = bobPage.url()

    // 1. Bob creates a subfolder inside the shared drive
    await bobDrive.createFolder(NESTED_CHILD)
    await bobDrive.row(NESTED_CHILD).waitVisible()

    // 2. Bob navigates into the subfolder
    await bobDrive.row(NESTED_CHILD).open()
    await expect.poll(() => bobPage.url()).not.toBe(parentDriveUrl)
    await expect(
      bobPage.locator('main').getByRole('navigation').first()
    ).toContainText(NESTED_CHILD)
    const childFolderUrl = bobPage.url()

    // 3. Bob opens the share modal on the subfolder
    await bobPage.goto(`${childFolderUrl}/share`)
    const modal = new ShareModalPage(bobPage)
    await modal.waitForOpen()

    // 4. Bob adds Charlie as Editor to the nested subfolder
    await modal.setNewMemberRole('Editor')
    await modal.addMember(USERS.charlie.email)
    await modal.share()

    // 5. Bob reopens share modal on the nested subfolder
    await bobPage.goto(`${childFolderUrl}/share`)
    const nestedModal = new ShareModalPage(bobPage)
    await nestedModal.waitForOpen()
    await expect(nestedModal.memberItem(USERS.charlie.email)).toBeVisible()
    await expect(nestedModal.memberRole(USERS.charlie.email)).toContainText(/editor/i)

    // 6. Bob downgrades Charlie to Viewer
    await nestedModal.setMemberRole(USERS.charlie.email, 'Viewer')
    await expect(nestedModal.memberRole(USERS.charlie.email)).toContainText(/viewer/i)

    // 7. Bob removes Charlie from the nested sharing
    await nestedModal.memberRemoveButton(USERS.charlie.email).click()
    await expect(nestedModal.memberItem(USERS.charlie.email)).toHaveCount(0)

    await nestedModal.close()
  })
})
