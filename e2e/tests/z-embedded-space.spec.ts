import { USERS } from '../helpers/config'
import { test, expect, escapeRegExp, stamp } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'
import { createFile, findDriveSharingIdForFile } from '../helpers/stack'
import { EmbeddedSpacePage } from '../pages/EmbeddedSpacePage'
import { FileViewerPage } from '../pages/FileViewerPage'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const DRIVE_NAME = `Space ${stamp()}`
const SEED_FILE = `space-seed-${stamp()}.txt`
const LIVE_FILE = `space-live-${stamp()}.txt`
let driveId = ''
let driveFolderId = ''

test.describe.serial('Embedded space of a shared drive', () => {
  test('Alice shares a drive seeded with one file', async ({
    alicePage,
    aliceDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
      seed: async () => {
        driveFolderId = alicePage.url().match(/\/folder\/([^/?]+)/)?.[1] ?? ''
        await createFile({
          instance: USERS.alice.instance,
          name: SEED_FILE,
          content: SEED_FILE,
          parentId: driveFolderId
        })
      }
    })
    driveId = await findDriveSharingIdForFile({
      instance: USERS.alice.instance,
      fileId: driveFolderId
    })
  })

  test('Bob gets only the drive in the space', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    const space = new EmbeddedSpacePage(bobPage, USERS.bob, driveId)
    await space.open()

    await bobDrive.row(SEED_FILE).waitVisible()
    await expect(space.breadcrumb).toContainText(DRIVE_NAME)
    await expect(bobDrive.createButton).toBeEnabled()
    await expect(bobDrive.uploadButton).toBeEnabled()
    await expect(space.chrome).toHaveCount(0)
  })

  test('Bob browses and creates without leaving the space, Alice sees it live', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
    const space = new EmbeddedSpacePage(bobPage, USERS.bob, driveId)
    await space.open()
    await bobDrive.row(SEED_FILE).waitVisible()

    const sub = `Sub ${stamp()}`
    await bobDrive.createFolder(sub)
    await expect(bobPage).toHaveURL(space.routePattern)
    await aliceDrive.row(sub).waitVisible({ timeout: 30_000 })

    await bobDrive.row(sub).open()
    await expect(space.breadcrumb).toContainText(sub)
    await expect(bobPage).toHaveURL(space.routePattern)

    await space.goUpTo(DRIVE_NAME)
    await bobDrive.row(SEED_FILE).waitVisible()
    await expect(bobPage).toHaveURL(space.routePattern)
  })

  test("Alice's new file shows up in the space live and opens in it", async ({
    bobPage,
    bobDrive
  }) => {
    const space = new EmbeddedSpacePage(bobPage, USERS.bob, driveId)
    await space.open()
    await bobDrive.row(SEED_FILE).waitVisible()

    await createFile({
      instance: USERS.alice.instance,
      name: LIVE_FILE,
      content: LIVE_FILE,
      parentId: driveFolderId
    })
    const row = bobDrive.row(LIVE_FILE)
    await row.waitVisible({ timeout: 30_000 })

    const fileId = await row.fileId()
    await row.open()
    await expect(bobPage).toHaveURL(
      new RegExp(
        `${space.routePattern.source}${escapeRegExp(`${driveFolderId}/file/${fileId}`)}`
      )
    )
    await new FileViewerPage(bobPage).expectTextContent(LIVE_FILE)
  })

  test('an unknown drive shows "not found" without the Drive chrome', async ({
    bobPage
  }) => {
    const space = new EmbeddedSpacePage(bobPage, USERS.bob, 'doesnotexist')
    await bobPage.goto(`${USERS.bob.appUrl}/#/embed/sharings/doesnotexist`)
    await expect(space.notFound).toBeVisible({ timeout: 15_000 })
    await expect(space.chrome).toHaveCount(0)
  })
})
