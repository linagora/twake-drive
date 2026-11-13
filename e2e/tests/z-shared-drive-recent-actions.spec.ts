import type { Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import { createFile, trashByName } from '../helpers/stack'
import type { DrivePage } from '../pages/DrivePage'
import { SidebarPage } from '../pages/SidebarPage'

const DRIVE_NAME = `Recent actions drive ${stamp()}`
const FILE_NAME = `recent-action-${stamp()}.txt`
const TRASHED_NAME = `recent-trash-${stamp()}.txt`

/** Browsing the drive first lets the data-proxy replicate it, which is what
 * brings its items into the Recents of a member. */
async function openRecentAsBob(
  page: Page,
  drive: DrivePage,
  name: string
): Promise<void> {
  await openSharedDrive(page, USERS.bob, drive, DRIVE_NAME)
  await drive.row(name).waitVisible({ timeout: 10_000 })
  await new SidebarPage(page).goToRecent()
  await page.waitForURL(/\/recent$/)
  await drive.row(name).waitVisible({ timeout: 25_000 })
}

/** The Recent view of a member lists the drive items next to local files,
 * but its routes carry no driveId: the actions must reach the drive. */
test.describe.serial('Shared drive actions in Recents (recipient)', () => {
  test.afterAll(async () => {
    await trashByName(USERS.alice.instance, DRIVE_NAME)
  })

  test('Alice shares a folder containing two files with Bob', async ({
    alicePage,
    aliceDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
      seed: async () => {
        const folderId = new URL(alicePage.url()).hash.split('/').pop()
        if (!folderId) throw new Error(`No folder id for ${DRIVE_NAME}`)
        for (const name of [FILE_NAME, TRASHED_NAME]) {
          await createFile({
            instance: USERS.alice.instance,
            name,
            content: name,
            parentId: folderId
          })
        }
      }
    })
  })

  test('Bob opens the share, history and move modals of a drive file', async ({
    bobPage,
    bobDrive
  }) => {
    await openRecentAsBob(bobPage, bobDrive, FILE_NAME)
    const row = bobDrive.row(FILE_NAME)

    const share = await row.share()
    await expect(bobPage).toHaveURL(/\/recent\/shareddrive\/[^/]+\/file\//)
    await expect(share.dialog).toContainText(FILE_NAME, { timeout: 15_000 })
    await share.close()

    const history = await row.openHistory()
    await expect(bobPage).toHaveURL(/\/recent\/shareddrive\/[^/]+\/file\//)
    await expect(history.dialog).toContainText(FILE_NAME, { timeout: 15_000 })
    await history.close()

    const moveTo = await row.openMoveTo()
    await expect(bobPage).toHaveURL(
      /\/recent\/shareddrive\/[^/]+\/[^/]+\/move$/
    )
    // The modal lists the file once it has read it through the drive
    await expect(moveTo.dialogLocator).toContainText(FILE_NAME, {
      timeout: 15_000
    })
    await moveTo.close()
  })

  test('Bob trashes a drive file through the drive route', async ({
    bobPage,
    bobDrive
  }) => {
    await openRecentAsBob(bobPage, bobDrive, TRASHED_NAME)
    const deletion = bobPage.waitForResponse(
      res => res.request().method() === 'DELETE'
    )
    await bobDrive.row(TRASHED_NAME).confirmTrash()

    const response = await deletion
    expect(new URL(response.url()).pathname).toMatch(
      /^\/sharings\/drives\/[^/]+\//
    )
    expect(response.ok()).toBeTruthy()
    await expect(bobDrive.trashSuccessAlert).toBeVisible()

    // The Recent list only drops the drive item once it is read again
    await bobPage.reload()
    await bobDrive.row(FILE_NAME).waitVisible({ timeout: 25_000 })
    await expect(bobDrive.row(TRASHED_NAME).cell).toHaveCount(0)
  })
})
