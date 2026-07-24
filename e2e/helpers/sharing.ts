import type { Page } from '@playwright/test'

import { USERS, User } from './config'
import { expect } from './fixtures'
import { DrivePage } from '../pages/DrivePage'
import { ShareModalPage } from '../pages/ShareModalPage'

/**
 * Cross-instance sharing flows shared by the shared-drive specs. With the
 * federated flags on, sharing a folder through the modal creates a shared
 * drive on the stack, so "share a folder" and "create a shared drive" are
 * the same UI gesture.
 */

interface ShareFolderOptions {
  /** Role granted to Bob. The modal defaults to Editor. */
  role?: 'Viewer' | 'Editor'
  /** Runs inside the folder before it is shared — seed content here so the
   * drive starts non-empty. */
  seed?: () => Promise<void>
}

/** Alice creates a folder at her root, optionally seeds it, and shares it
 * with Bob from inside the folder via the toolbar Share button. */
export async function createAndShareFolderWithBob(
  alicePage: Page,
  aliceDrive: DrivePage,
  folderName: string,
  opts: ShareFolderOptions = {}
): Promise<void> {
  await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
  await aliceDrive.createFolder(folderName)
  await aliceDrive.row(folderName).open()
  await alicePage.waitForURL(/\/folder\/[^/]+$/)

  await opts.seed?.()

  await alicePage.getByRole('button', { name: /share/i }).click()
  const modal = new ShareModalPage(alicePage)
  await modal.waitForOpen()
  if (opts.role) await modal.setNewMemberRole(opts.role)
  await modal.addMember(USERS.bob.email)
  await modal.share()
}

/** The Sharings list is split into tab routes: rows shared
 * WITH the user live on `with-me` (the default), the user's own shares on
 * `by-me`, organizational drives on `drives`. */
export type SharingsTab = 'with-me' | 'by-me' | 'drives'

/** Sharing propagates asynchronously across instances — reload the user's
 * Sharings tab until the row shows up. Recipients find their rows on the
 * default `with-me` tab; pass `by-me` when asserting the OWNER's side. */
export async function waitForSharingRow(
  page: Page,
  user: User,
  drive: DrivePage,
  name: string,
  tab: SharingsTab = 'with-me'
): Promise<void> {
  await expect(async () => {
    await page.goto(`${user.appUrl}/#/sharings/${tab}`)
    await drive.row(name).waitVisible({ timeout: 5_000 })
  }).toPass({ timeout: 30_000 })
}

/**
 * Open a shared drive as the RECIPIENT, from their Sharings tab. The
 * recipient has no local copy, so the drive opens on the proxied
 * /shareddrive/:driveId/:folderId route.
 */
export async function openSharedDrive(
  page: Page,
  user: User,
  drive: DrivePage,
  name: string
): Promise<void> {
  await waitForSharingRow(page, user, drive, name)
  await drive.row(name).open()
  await page.waitForURL(/\/shareddrive\/[^/]+\/[^/]+/)
}

/**
 * Open the same folder as its OWNER, from My Drive. The owner shares their
 * own folder, so the live content sits in their storage and renders on the
 * regular /folder route — there is no proxied /shareddrive view on the
 * owner's side. Use this to assert what the owner sees after a recipient
 * writes into the drive.
 */
export async function openOwnerFolder(
  page: Page,
  user: User,
  drive: DrivePage,
  name: string
): Promise<void> {
  await page.goto(`${user.appUrl}/#/folder`)
  await drive.row(name).open()
  await page.waitForURL(/\/folder\/[^/]+$/)
}
