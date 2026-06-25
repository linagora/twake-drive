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
const VIEWER_DRIVE = `Viewer Drive ${stamp()}`
const VIEWER_FILE = `viewer-file-${stamp()}.txt`
const LEAVE_DRIVE = `Leave Drive ${stamp()}`

test.describe.serial('Shared drive members & permissions', () => {
  test('Alice shares a drive with Bob as Viewer', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, VIEWER_FILE)
    await copyFile(SAMPLE, filePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, VIEWER_DRIVE, {
        role: 'Viewer',
        seed: async () => {
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(VIEWER_FILE).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('Bob can browse the drive but gets no Create/Upload controls', async ({
    bobPage,
    bobDrive
  }) => {
    // Control: on his own drive root the write controls are there, so the
    // hidden-assertions below can't pass because of a wrong selector.
    await bobPage.goto(`${USERS.bob.appUrl}/#/folder`)
    const createButton = bobPage.getByRole('button', { name: /^create$/i })
    const uploadButton = bobPage.getByRole('button', { name: /^upload$/i })
    await expect(createButton).toBeVisible()
    await expect(uploadButton).toBeVisible()

    await openSharedDrive(bobPage, USERS.bob, bobDrive, VIEWER_DRIVE)
    await bobDrive.row(VIEWER_FILE).waitVisible({ timeout: 10_000 })

    // Read-only recipients see write entry points as disabled.
    await expect(createButton).toBeVisible()
    await expect(createButton).toBeDisabled()
    await expect(uploadButton).toBeVisible()
    await expect(uploadButton).toBeDisabled()
  })

  test('the members panel shows Bob as Viewer', async ({
    alicePage,
    aliceDrive
  }) => {
    // The owner manages members through the share modal, reachable from the
    // Sharings-list row without entering the drive (the owner's in-drive view
    // is the regular /folder route, not the proxied /shareddrive one).
    await waitForSharingRow(alicePage, USERS.alice, aliceDrive, VIEWER_DRIVE)
    const modal = await aliceDrive.row(VIEWER_DRIVE).share()
    await expect(modal.memberItem('bob')).toContainText(/viewer/i)
    await modal.close()
  })

  test('Alice removes Bob and the drive drops out of his Sharings', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await waitForSharingRow(alicePage, USERS.alice, aliceDrive, VIEWER_DRIVE)
    const modal = await aliceDrive.row(VIEWER_DRIVE).share()
    await modal.removeMember('bob')
    await modal.close()

    // Revocation propagates to Bob's instance asynchronously.
    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)
      await bobDrive.row(VIEWER_DRIVE).waitHidden({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })

  test('Bob leaves a sharing from his side', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, LEAVE_DRIVE)
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, LEAVE_DRIVE)

    const menu = await bobDrive.row(LEAVE_DRIVE).openMenu()
    await menu.getByRole('menuitem', { name: /leave sharing/i }).click()

    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)
      await bobDrive.row(LEAVE_DRIVE).waitHidden({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })
})
