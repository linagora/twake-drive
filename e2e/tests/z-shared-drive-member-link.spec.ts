import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'
import { createFile } from '../helpers/stack'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const DRIVE_NAME = `Member Link Drive ${stamp()}`
const TRASHED = `member-link-${stamp()}.txt`

/**
 * The public links of a shared drive live on its owner's instance, so
 * refreshing a member's sharings does not return them. Sending a file to the
 * Bin triggers that refresh: the link the member created must survive it.
 */
test.describe.serial('Public link of a shared drive member', () => {
  test('Alice shares a drive with a file inside', async ({
    alicePage,
    aliceDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME)
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
    const driveFolderId = alicePage.url().match(/\/folder\/([^/?]+)/)?.[1]
    if (!driveFolderId) throw new Error(`No folder id for ${DRIVE_NAME}`)
    await createFile({
      instance: USERS.alice.instance,
      name: TRASHED,
      content: TRASHED,
      parentId: driveFolderId
    })
    await aliceDrive.row(TRASHED).waitVisible()
  })

  test('Bob still manages his link after sending a file to the Bin', async ({
    bobPage,
    bobDrive
  }) => {
    await bobPage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(TRASHED).waitVisible()

    const modal = await bobDrive.openShareFromToolbarRecipients()
    const url = await new ShareByLinkPage(bobPage).createLink()
    await modal.close()

    await bobDrive.row(TRASHED).sendToTrash()

    await bobDrive.openShareFromToolbarRecipients()
    const link = new ShareByLinkPage(bobPage)
    await link.waitForLinkRow()
    expect(await link.copyLink()).toBe(url)
    await link.deactivate()
  })
})
