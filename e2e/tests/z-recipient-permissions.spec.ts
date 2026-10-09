import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive,
  waitForSharingRow
} from '../helpers/sharing'
import { trashByName } from '../helpers/stack'
import { ShareModalPage } from '../pages/ShareModalPage'

const READER_DRIVE = `Reader Members Drive ${stamp()}`
const EDITOR_DRIVE = `Editor Members Drive ${stamp()}`
const LEAVE_DRIVE = `Leave Members Drive ${stamp()}`
// const NESTED_DRIVE = `Nested Editor Drive ${stamp()}`
// const NESTED_CHILD = `Nested Child ${stamp()}`

test.describe.serial('Recipient permissions & member controls', () => {
  test.afterAll(async () => {
    await trashByName(USERS.alice.instance, READER_DRIVE)
    await trashByName(USERS.alice.instance, EDITOR_DRIVE)
    await trashByName(USERS.alice.instance, LEAVE_DRIVE)
    // await trashByName(USERS.alice.instance, NESTED_DRIVE)
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

    // Navigating back to Bob's sharings list. READER_DRIVE stays shared with
    // Bob: its row proves the list has loaded before asserting the absence.
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, READER_DRIVE)
    await expect(bobDrive.row(LEAVE_DRIVE).cell).toHaveCount(0)
  })

  // Disabled until cozy-stack lets a shared drive recipient create a
  // sharing on a subfolder of a drive they do not own: POST /sharings/drives
  // runs on the recipient instance where the folder does not exist (404).
  // See linagora/twake-drive#4288 for what the stack needs. When re-enabling
  // it, move the breadcrumb locator into DrivePage (no raw selectors here).
  // test('Alice shares nested parent drive with Bob as Editor', async ({
  //   alicePage,
  //   aliceDrive
  // }) => {
  //   await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
  //   await aliceDrive.createFolder(NESTED_DRIVE)
  //   await aliceDrive.openFolder(NESTED_DRIVE)
  //
  //   const modal = await aliceDrive.openShareModal()
  //   await modal.setNewMemberRole('Editor')
  //   await modal.addMember(USERS.bob.email)
  //   await modal.share()
  //
  //   await waitForSharingRow(
  //     alicePage,
  //     USERS.alice,
  //     aliceDrive,
  //     NESTED_DRIVE,
  //     'by-me'
  //   )
  // })
  //
  // test('Editor (Bob) can add, downgrade, and remove a member on a nested sharing', async ({
  //   bobPage,
  //   bobDrive
  // }) => {
  //   await openSharedDrive(bobPage, USERS.bob, bobDrive, NESTED_DRIVE)
  //   const parentDriveUrl = bobPage.url()
  //
  //   // 1. Bob creates a subfolder inside the shared drive
  //   await bobDrive.createFolder(NESTED_CHILD)
  //   await bobDrive.row(NESTED_CHILD).waitVisible()
  //
  //   // 2. Bob navigates into the subfolder
  //   await bobDrive.row(NESTED_CHILD).open()
  //   await expect.poll(() => bobPage.url()).not.toBe(parentDriveUrl)
  //   await expect(
  //     bobPage.locator('main').getByRole('navigation').first()
  //   ).toContainText(NESTED_CHILD)
  //   const childFolderUrl = bobPage.url()
  //
  //   // 3. Bob opens the share modal on the subfolder
  //   await bobPage.goto(`${childFolderUrl}/share`)
  //   const modal = new ShareModalPage(bobPage)
  //   await modal.waitForOpen()
  //
  //   // 4. Bob adds Charlie as Editor to the nested subfolder
  //   await modal.setNewMemberRole('Editor')
  //   await modal.addMember(USERS.charlie.email)
  //   await modal.share()
  //
  //   // 5. Bob reopens share modal on the nested subfolder
  //   await bobPage.goto(`${childFolderUrl}/share`)
  //   const nestedModal = new ShareModalPage(bobPage)
  //   await nestedModal.waitForOpen()
  //   await expect(nestedModal.memberItem(USERS.charlie.email)).toBeVisible()
  //   await expect(nestedModal.memberRole(USERS.charlie.email)).toContainText(/editor/i)
  //
  //   // 6. Bob downgrades Charlie to Viewer
  //   await nestedModal.setMemberRole(USERS.charlie.email, 'Viewer')
  //   await expect(nestedModal.memberRole(USERS.charlie.email)).toContainText(/viewer/i)
  //
  //   // 7. Bob removes Charlie from the nested sharing
  //   await nestedModal.memberRemoveButton(USERS.charlie.email).click()
  //   await expect(nestedModal.memberItem(USERS.charlie.email)).toHaveCount(0)
  //
  //   await nestedModal.close()
  // })
})

const MANAGED_DRIVE = `Managed Members Drive ${stamp()}`
const VIEWER_SELF_DRIVE = `Viewer Self Drive ${stamp()}`

test.describe.serial('Recipient edits himself and other members', () => {
  test.afterAll(async () => {
    await trashByName(USERS.alice.instance, MANAGED_DRIVE)
    await trashByName(USERS.alice.instance, VIEWER_SELF_DRIVE)
  })

  test('Alice shares a drive with Bob and Charlie as Editors', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(MANAGED_DRIVE)
    await aliceDrive.openFolder(MANAGED_DRIVE)

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
      MANAGED_DRIVE,
      'by-me'
    )
  })

  test('Alice shares a drive with Bob and Charlie as Viewers', async ({
    alicePage,
    aliceDrive
  }) => {
    await createAndShareFolderWithBob(
      alicePage,
      aliceDrive,
      VIEWER_SELF_DRIVE,
      {
        role: 'Viewer'
      }
    )

    await alicePage.goto(`${alicePage.url()}/share`)
    const modal = new ShareModalPage(alicePage)
    await modal.waitForOpen()
    await modal.setNewMemberRole('Viewer')
    await modal.addMember(USERS.charlie.email)
    await modal.share()

    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      VIEWER_SELF_DRIVE,
      'by-me'
    )
  })

  test('Editor (Bob) downgrades Charlie to Viewer without changing himself', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, MANAGED_DRIVE)

    const modal = await bobDrive.openShareFromToolbarRecipients()
    await expect(modal.memberRole(USERS.charlie.email)).toContainText(/editor/i)
    await modal.setMemberRole(USERS.charlie.email, 'Viewer')

    await expect(modal.memberRole(USERS.charlie.email)).toContainText(/viewer/i)
    await expect(modal.memberRole('You')).toContainText(/editor/i)
    await modal.close()

    await expect(bobDrive.uploadButton).toBeEnabled()

    await bobPage.reload()
    const reopened = await bobDrive.openShareFromToolbarRecipients()
    await expect(reopened.memberRole(USERS.charlie.email)).toContainText(
      /viewer/i
    )
    await expect(reopened.memberRole('You')).toContainText(/editor/i)
    await reopened.close()
  })

  test('Owner (Alice) and Charlie see the downgrade made by Bob', async ({
    alicePage,
    aliceDrive,
    charliePage,
    charlieDrive
  }) => {
    await expect(async () => {
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, MANAGED_DRIVE)
      const modal = await aliceDrive.openShareModal()
      await expect(modal.memberRole(USERS.charlie.email)).toContainText(
        /viewer/i,
        { timeout: 2_000 }
      )
      await expect(modal.memberRole(USERS.bob.email)).toContainText(/editor/i)
    }).toPass({ timeout: 30_000 })

    await openSharedDrive(
      charliePage,
      USERS.charlie,
      charlieDrive,
      MANAGED_DRIVE
    )
    await expect(async () => {
      await charliePage.reload()
      await expect(charlieDrive.uploadButton).toBeDisabled({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
  })

  test('Editor (Bob) upgrades Charlie back to Editor', async ({
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, MANAGED_DRIVE)

    const modal = await bobDrive.openShareFromToolbarRecipients()
    await modal.setMemberRole(USERS.charlie.email, 'Editor')
    await expect(modal.memberRole(USERS.charlie.email)).toContainText(/editor/i)
    await expect(modal.memberRole('You')).toContainText(/editor/i)
    await modal.close()

    await openSharedDrive(
      charliePage,
      USERS.charlie,
      charlieDrive,
      MANAGED_DRIVE
    )
    await expect(async () => {
      await charliePage.reload()
      await expect(charlieDrive.uploadButton).toBeEnabled({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
  })

  test('Editor (Bob) removes Charlie and stays a member himself', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, MANAGED_DRIVE)

    const modal = await bobDrive.openShareFromToolbarRecipients()
    await modal.removeMember(USERS.charlie.email)

    await expect(modal.memberItem('You')).toBeVisible()
    await expect(modal.memberRole('You')).toContainText(/editor/i)
    await modal.close()

    await expect(bobDrive.uploadButton).toBeEnabled()

    await bobPage.reload()
    const reopened = await bobDrive.openShareFromToolbarRecipients()
    await expect(reopened.memberItem(USERS.charlie.email)).toHaveCount(0)
    await expect(reopened.memberItem('You')).toBeVisible()
    await reopened.close()
  })

  test('Owner (Alice) and Charlie see the removal made by Bob', async ({
    alicePage,
    aliceDrive,
    charliePage,
    charlieDrive
  }) => {
    await expect(async () => {
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, MANAGED_DRIVE)
      const modal = await aliceDrive.openShareModal()
      await expect(modal.memberItem(USERS.bob.email)).toBeVisible({
        timeout: 2_000
      })
      await expect(modal.memberItem(USERS.charlie.email)).toHaveCount(0)
    }).toPass({ timeout: 30_000 })

    // VIEWER_SELF_DRIVE stays shared with Charlie: its row proves the list
    // has loaded before asserting the absence.
    await expect(async () => {
      await waitForSharingRow(
        charliePage,
        USERS.charlie,
        charlieDrive,
        VIEWER_SELF_DRIVE
      )
      await expect(charlieDrive.row(MANAGED_DRIVE).cell).toHaveCount(0, {
        timeout: 2_000
      })
    }).toPass({ timeout: 60_000 })
  })

  test('Viewer (Bob) cannot upgrade himself to Editor', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, VIEWER_SELF_DRIVE)
    await expect(bobDrive.uploadButton).toBeDisabled()
    await expect(bobDrive.createButton).toBeDisabled()

    const modal = await bobDrive.openShareFromToolbarRecipients()
    await expect(modal.memberItem('You')).toContainText(/viewer/i)
    await expect(modal.memberRole('You')).toHaveCount(0)
    await modal.close()
  })
})
