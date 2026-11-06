import type { Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive,
  waitForSharingRow
} from '../helpers/sharing'
import { InvitationBannerPage } from '../pages/InvitationBannerPage'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const ACCEPTED = `Inv Acc ${stamp()}`
const DECLINED = `Inv Dec ${stamp()}`
const CLOSED = `Inv Close ${stamp()}`
const OURS = [ACCEPTED, DECLINED, CLOSED]

/** Reload Bob's Drive until the banner shows `name`. Banners left by other
 * specs on this worker are older, so they come first: close them. */
async function showInvitation(page: Page, name: string): Promise<void> {
  const invitation = new InvitationBannerPage(page)
  await expect(async () => {
    await page.goto(`${USERS.bob.appUrl}/#/folder`)
    let shown = await invitation.sharedName()
    while (shown !== '' && !OURS.includes(shown)) {
      await invitation.close()
      shown = await invitation.sharedName()
    }
    expect(shown).toBe(name)
  }).toPass({ timeout: 60_000 })
}

test.describe.serial('Sharing invitation banner', () => {
  test('Alice shares three folders with Bob', async ({
    alicePage,
    aliceDrive
  }) => {
    for (const name of OURS) {
      await createAndShareFolderWithBob(alicePage, aliceDrive, name)
    }
  })

  test('Bob accepts the first one without leaving Drive', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await showInvitation(bobPage, ACCEPTED)
    const url = bobPage.url()
    const invitation = new InvitationBannerPage(bobPage)
    await invitation.accept()

    expect(await invitation.sharedName()).toBe(DECLINED)
    expect(bobPage.context().pages()).toHaveLength(1)
    expect(bobPage.url()).toBe(url)

    await openSharedDrive(bobPage, USERS.bob, bobDrive, ACCEPTED)

    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, ACCEPTED)
    const modal = await aliceDrive.openShareModal()
    await expect(modal.memberRole(USERS.bob.email)).toHaveText(
      t('cozy-sharing:Share.type.two-way')
    )
  })

  test('Bob declines the second one and is no longer a member', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DECLINED)
    const before = await aliceDrive.openShareModal()
    await expect(before.memberItem(USERS.bob.email)).toBeVisible()
    await before.close()

    await showInvitation(bobPage, DECLINED)
    await new InvitationBannerPage(bobPage).decline()
    // The oldest pending invitation is now the third one.
    await showInvitation(bobPage, CLOSED)

    await waitForSharingRow(bobPage, USERS.bob, bobDrive, ACCEPTED)
    await expect(bobDrive.row(DECLINED).cell).toHaveCount(0)

    await expect(async () => {
      // A reload would keep the share route, so the modal of the previous
      // attempt: reopen the folder instead
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DECLINED)
      const modal = await aliceDrive.openShareModal()
      // Bob was the only member
      await expect(modal.noMemberNotice).toBeVisible({ timeout: 2_000 })
      await expect(modal.memberItem(USERS.bob.email)).toHaveCount(0)
    }).toPass({ timeout: 30_000 })
  })

  test('Bob closes the third one, which stays in his sharings', async ({
    bobPage,
    bobDrive
  }) => {
    const isNew = (): Promise<boolean> =>
      bobDrive.row(CLOSED).isNewSharingShortcut()
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, CLOSED)
    await expect.poll(isNew).toBe(true)

    await showInvitation(bobPage, CLOSED)
    await new InvitationBannerPage(bobPage).close()

    // Close marks the shortcut as seen on the stack, so the banner cannot
    // come back.
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, CLOSED)
    await expect.poll(isNew).toBe(false)
  })
})
