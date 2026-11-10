import { USERS } from '../helpers/config'
import { escapeRegExp, test, expect, stamp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'
import {
  createAndShareFolderWithBob,
  waitForSharingRow
} from '../helpers/sharing'
import { SidebarPage } from '../pages/SidebarPage'

// Guards linagora/twake-drive#4264: after removing a shared folder's last recipient, the owner must still be able to share and open it.
const FOLDER_NAME = `Unshared Folder ${stamp()}`

test.describe.serial('Unsharing a folder', () => {
  test('owner can still share and open it after the last recipient is removed', async ({
    alicePage,
    aliceDrive
  }) => {
    // Alice shares a folder with Bob (a shared drive under the federated flags).
    await createAndShareFolderWithBob(alicePage, aliceDrive, FOLDER_NAME)

    // From "Shared by me", remove Bob — the only recipient.
    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      FOLDER_NAME,
      'by-me'
    )
    const modal = await aliceDrive.row(FOLDER_NAME).share()
    await modal.removeMember('bob')

    // Modal must stay shareable (no link-only "shared parent" restriction, contact input present). Soft so the open-folder check below also runs.
    const dialog = alicePage.getByRole('dialog')
    await expect
      .soft(dialog, 'modal must stay shareable, not link-only')
      .not.toContainText(
        new RegExp(
          escapeRegExp(
            t('cozy-sharing:Files.share.shareByEmail.hasSharedParent')
          ),
          'i'
        )
      )
    await expect
      .soft(dialog.getByRole('textbox').first(), 'owner can still add contacts')
      .toBeVisible()
    await modal.close()

    // Folder must still open from My Drive; navigate in-app (page.goto would reload and mask the bug).
    await new SidebarPage(alicePage).goToMyDrive()
    await alicePage.waitForURL(/\/folder(\/[^/]+)?$/)
    await aliceDrive.row(FOLDER_NAME).waitVisible()
    await aliceDrive.openFolder(FOLDER_NAME)
    await expect(
      aliceDrive.openFolderError,
      'folder must open without error'
    ).toBeHidden()
  })
})
