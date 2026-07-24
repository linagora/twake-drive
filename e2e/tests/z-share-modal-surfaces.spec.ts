import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive,
  waitForSharingRow
} from '../helpers/sharing'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

// Shared across .serial tests in this describe — do not enable fullyParallel.
const DRIVE_NAME = `Surface Drive ${stamp()}`
// Lead with a stable token so the modal title (which truncates the tail) can
// be matched on the prefix.
const FILE_PREFIX = 'surface-file'
const FILE_NAME = `${FILE_PREFIX}-${stamp()}.txt`

/**
 * Regression guards for where the share modal renders. Two recent fixes:
 *  - from the Sharings list, Share must layer the modal over the list
 *    (`/sharings/:tab/shareddrive/:driveId/:fileId/share`) instead of
 *    navigating into the drive's folder view;
 *  - from the file viewer inside a shared drive, Share navigates to a
 *    relative `v/share`, which needs its own route or the page goes blank.
 */
test.describe.serial('Share modal surfaces (shared drives)', () => {
  test('Alice shares a drive with a file inside', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, FILE_NAME)
    await copyFile(SAMPLE, filePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(FILE_NAME).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('Share from the Sharings list opens the modal over the list', async ({
    alicePage,
    aliceDrive
  }) => {
    // Alice owns the drive, so her row lives on the by-me tab.
    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      DRIVE_NAME,
      'by-me'
    )

    const modal = await aliceDrive.row(DRIVE_NAME).share()

    // The modal is layered over the sharings list: the URL is the dedicated
    // overlay route and the list is still mounted underneath.
    await expect(alicePage).toHaveURL(
      /\/sharings\/by-me\/shareddrive\/[^/]+\/[^/]+\/share/
    )
    await expect(alicePage.getByTestId('fil-content-body')).toBeVisible()

    await modal.close()
    // Closing the modal returns to the tab it was opened from.
    await expect(alicePage).toHaveURL(/#\/sharings\/by-me$/)
  })

  test('Share from the shared-drive file viewer renders the modal', async ({
    bobPage,
    bobDrive
  }) => {
    // The v/share route lives under the recipient's proxied shared-drive
    // viewer, so this is Bob's path (he's an Editor, so the viewer's sharing
    // affordances stay enabled). The owner never reaches this route — his
    // copy opens on the plain /folder viewer.
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(FILE_NAME).open()
    await bobPage.waitForURL(/\/shareddrive\/[^/]+\/[^/]+\/file\/[^/]+/)

    // new-file-viewer-ui is off in the e2e stack, so the viewer's Share
    // affordance lives in the actions (dots) menu. That trigger is icon-only;
    // the Download button carries a text label, so restricting to text-less
    // buttons keeps the target stable if cozy-viewer appends a labelled
    // toolbar button (summarize, print, ...).
    const toolbar = bobPage.getByTestId('viewer-toolbar')
    await toolbar
      .getByRole('button')
      .filter({ hasNotText: /\S/ })
      .last()
      .click()
    await bobPage
      .getByRole('menu')
      .getByRole('menuitem', { name: /^share$/i })
      .click()

    // The fixed route: `v/share` under the shared-drive file viewer. The
    // regression rendered a blank page here — no dialog, no viewer.
    await expect(bobPage).toHaveURL(/\/v\/share($|\?|#)/)
    const dialog = bobPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(FILE_PREFIX)
  })
})
