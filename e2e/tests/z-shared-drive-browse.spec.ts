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
// Names lead with a stable, short token: the breadcrumb truncates the tail,
// so assertions/clicks match on the prefix which always survives.
const DRIVE_PREFIX = 'BrowseDrive'
const SUB_PREFIX = 'BrowseSub'
const DRIVE_NAME = `${DRIVE_PREFIX}-${stamp()}`
const SUBFOLDER = `${SUB_PREFIX}-${stamp()}`
const FILE_NAME = `browse-file-${stamp()}.txt`

test.describe.serial('Shared drive browsing (recipient)', () => {
  test('Alice shares a folder with content and it lands in her Sharings', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, FILE_NAME)
    await copyFile(SAMPLE, filePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.createFolder(SUBFOLDER)
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(FILE_NAME).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }

    await waitForSharingRow(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
  })

  test('the share auto-accepts as a proxied drive Bob can browse', async ({
    bobPage,
    bobDrive
  }) => {
    // The recipient has no local copy: the row opens the proxied
    // /shareddrive route, not a regular /folder view. openSharedDrive already
    // awaits that URL, so the seeded rows below are the meaningful proof.
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)

    // Listing is proxied from Alice's instance — both seeded entries render.
    await bobDrive.row(SUBFOLDER).waitVisible({ timeout: 10_000 })
    await bobDrive.row(FILE_NAME).waitVisible()

    // Breadcrumb anchors the proxied view under the drive (prefix match: the
    // tail is truncated).
    const breadcrumb = bobPage.locator('main').getByRole('navigation').first()
    await expect(breadcrumb).toContainText(DRIVE_PREFIX)
  })

  test('Bob navigates into a subfolder and back out via the breadcrumb', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    const driveRootUrl = bobPage.url()

    await bobDrive.row(SUBFOLDER).open()
    // Still on the shared-drive route, but a different folder id.
    await bobPage.waitForURL(/\/shareddrive\/[^/]+\/[^/]+/)
    expect(bobPage.url()).not.toBe(driveRootUrl)

    // The subfolder is empty — the dropzone empty state renders instead of an
    // error or a stuck skeleton.
    await expect(bobPage.getByText(/drag them here/i)).toBeVisible({
      timeout: 10_000
    })

    // Climb back up through the breadcrumb (prefix match: the tail truncates).
    const breadcrumb = bobPage.locator('main').getByRole('navigation').first()
    await breadcrumb.getByText(DRIVE_PREFIX, { exact: false }).first().click()
    await bobDrive.row(SUBFOLDER).waitVisible({ timeout: 10_000 })
    await bobDrive.row(FILE_NAME).waitVisible()
  })
})
