import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { openSharedDrive } from '../helpers/sharing'
import { findLinkPermission, trashById } from '../helpers/stack'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'
import { ShareModalPage } from '../pages/ShareModalPage'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const DRIVE_NAME = `Link Drive ${stamp()}`
let driveFolderId: string
let linkId: string
let linkRev: string | undefined

/**
 * Shows the current, known-wrong behaviour of share links in a shared drive:
 * any member may create the link, but the stack only lets the drive owner or
 * the link creator change or remove it. The share modal still offers its
 * management to every member (`canManageLink={true}` in cozy-sharing's
 * FederatedFolderModal), so another editor gets controls that fail with a
 * 403. Flip these assertions once the expected behaviour is decided.
 */
test.describe.serial('Share link of a shared drive (another editor)', () => {
  test.afterAll(async () => {
    if (driveFolderId) await trashById(USERS.alice.instance, driveFolderId)
  })

  test('Alice shares a drive with Bob and Charlie as editors', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(DRIVE_NAME)
    await aliceDrive.openFolder(DRIVE_NAME)
    driveFolderId = new URL(alicePage.url()).hash.split('/').pop() ?? ''
    expect(driveFolderId).not.toBe('')

    const modal = await aliceDrive.openShareModal()
    await modal.addMember(USERS.bob.email)
    await modal.addMember(USERS.charlie.email)
    await modal.share()
  })

  test('Charlie, an editor, creates a share link', async ({
    charliePage,
    charlieDrive
  }) => {
    await charliePage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])
    await openSharedDrive(charliePage, USERS.charlie, charlieDrive, DRIVE_NAME)
    await charlieDrive.openShareFromToolbarRecipients()
    await new ShareByLinkPage(charliePage).createLink()
    await new ShareModalPage(charliePage).dismiss()

    const permission = await findLinkPermission(
      USERS.alice.instance,
      driveFolderId
    )
    linkId = permission.id
    linkRev = permission.meta?.rev
  })

  test('Bob, another editor, is offered to manage the link', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.openShareFromToolbarRecipients()
    const link = new ShareByLinkPage(bobPage)
    await link.waitForLinkRow()
    await link.expectManageable()
  })

  test('Bob cannot protect the link with a password', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.openShareFromToolbarRecipients()
    const link = new ShareByLinkPage(bobPage)
    await link.waitForLinkRow()
    await link.openRestrictions()
    await link.enablePassword(`pw-${stamp()}`)

    expect(await link.submitRestrictions()).toBe(403)
    // The refusal is silent: no alert, the settings just stay open.
    await link.expectRestrictionsOpen()
  })

  test('Bob cannot deactivate the link', async ({ bobPage, bobDrive }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.openShareFromToolbarRecipients()
    const link = new ShareByLinkPage(bobPage)
    await link.waitForLinkRow()

    expect(await link.requestDeactivation()).toBe(403)

    // The link still exists once the modal reads it again.
    await new ShareModalPage(bobPage).dismiss()
    await bobDrive.openShareFromToolbarRecipients()
    await link.waitForLinkRow()
  })

  test('The link is left untouched on the owner instance', async () => {
    const permission = await findLinkPermission(
      USERS.alice.instance,
      driveFolderId
    )
    expect(permission.id).toBe(linkId)
    expect(permission.meta?.rev).toBe(linkRev)
  })
})
