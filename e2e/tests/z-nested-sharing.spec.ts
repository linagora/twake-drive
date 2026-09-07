import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { ShareModalPage } from '../pages/ShareModalPage'

const PARENTFOLDER = `Nested Parent ${stamp()}`
const SUBFOLDER = `Nested Child ${stamp()}`

// Modal surfaces with the default FEATURE_FLAGS (federated on): sharing a
// folder creates a shared drive, and the share modal of a folder inside a
// shared one shows the only-by-link banner instead of the contact input and
// the Done button, while keeping the parent's members listed and manageable.
test.describe.serial('Nested sharing — share modal surfaces', () => {
  test('parent modal before sharing', async ({ alicePage, aliceDrive }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(PARENTFOLDER)
    await aliceDrive.openFolder(PARENTFOLDER)

    await aliceDrive.createFolder(SUBFOLDER)

    await alicePage.getByRole('button', { name: /share/i }).click()
    const modal = new ShareModalPage(alicePage)
    await modal.waitForOpen()

    // Not shared and no shared child: the classic modal.
    await expect(
      modal.dialog.getByText(/can only be shared by link/i)
    ).toHaveCount(0)
    await expect(modal.dialog.getByRole('combobox')).toBeVisible()
    await expect(modal.dialog.getByRole('listitem').first()).toBeVisible()
    await expect(
      modal.dialog.getByRole('button', { name: /^copy link$/i })
    ).toBeVisible()
    await expect(
      modal.dialog.getByRole('button', { name: /^done$/i })
    ).toBeVisible()

    await modal.addMember(USERS.bob.email)
    await modal.share()
  })

  test('parent modal after sharing shows members with permission menu', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.openFolder(PARENTFOLDER)

    await alicePage.getByRole('button', { name: /share/i }).click()
    const modal = new ShareModalPage(alicePage)
    await modal.waitForOpen()

    // Auto-accept is on in the e2e stack, so Bob is a confirmed member and
    // carries the per-member role menu.
    await expect(modal.memberItem('bob')).toBeVisible()
    await expect(modal.memberRole('bob')).toHaveText(/editor/i)

    await modal.close()
  })

  test('child modal of a shared folder', async ({ alicePage, aliceDrive }) => {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.openFolder(PARENTFOLDER)
    await aliceDrive.openFolder(SUBFOLDER)

    await alicePage.getByRole('button', { name: /share/i }).click()
    const modal = new ShareModalPage(alicePage)
    await modal.waitForOpen()

    await expect(
      modal.dialog.getByText(/can only be shared by link/i)
    ).toBeVisible()
    await expect(modal.dialog.getByRole('combobox')).toHaveCount(0)
    await expect(modal.memberItem('bob')).toBeVisible()
    await expect(modal.memberRole('bob')).toHaveText(/editor/i)
    await expect(
      modal.dialog.getByRole('button', { name: /^copy link$/i })
    ).toBeVisible()
    await expect(
      modal.dialog.getByRole('button', { name: /^done$/i })
    ).toHaveCount(0)

    await modal.close()
  })
})

// Self-contained scenarios on a directly shared child, each with its own
// fixtures — outside the serial chain above so a failure there can't skip
// them.
test.describe('Nested sharing — direct child sharing', () => {
  test('child modal shared directly', async ({ alicePage, aliceDrive }) => {
    const parent = `Nested Direct Parent ${stamp()}`
    const child = `Nested Direct Child ${stamp()}`

    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(parent)
    await aliceDrive.openFolder(parent)
    await aliceDrive.createFolder(child)
    await aliceDrive.openFolder(child)

    // Before sharing: no shared parent, no shared child — classic modal.
    await alicePage.getByRole('button', { name: /share/i }).click()
    const modal = new ShareModalPage(alicePage)
    await modal.waitForOpen()

    await expect(
      modal.dialog.getByText(/can only be shared by link/i)
    ).toHaveCount(0)
    await expect(modal.dialog.getByRole('combobox')).toBeVisible()
    await expect(modal.dialog.getByRole('listitem').first()).toBeVisible()
    await expect(modal.memberItem('bob')).toHaveCount(0)
    await expect(
      modal.dialog.getByRole('button', { name: /^copy link$/i })
    ).toBeVisible()
    await expect(
      modal.dialog.getByRole('button', { name: /^done$/i })
    ).toBeVisible()

    await modal.addMember(USERS.bob.email)
    await modal.share()

    // The child is now the root of its own shared drive: the modal stays
    // classic and Bob is a confirmed member with a role menu.
    await alicePage.getByRole('button', { name: /share/i }).click()
    const sharedModal = new ShareModalPage(alicePage)
    await sharedModal.waitForOpen()

    await expect(
      sharedModal.dialog.getByText(/can only be shared by link/i)
    ).toHaveCount(0)
    await expect(sharedModal.dialog.getByRole('combobox')).toBeVisible()
    await expect(sharedModal.memberItem('bob')).toBeVisible()
    await expect(sharedModal.memberRole('bob')).toHaveText(/editor/i)
    await expect(
      sharedModal.dialog.getByRole('button', { name: /^copy link$/i })
    ).toBeVisible()
    await expect(
      sharedModal.dialog.getByRole('button', { name: /^done$/i })
    ).toBeVisible()

    await sharedModal.close()
  })

  test('parent modal of a shared child', async ({ alicePage, aliceDrive }) => {
    const parent = `Nested Shared-Child Parent ${stamp()}`
    const child = `Nested Shared-Child Child ${stamp()}`

    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.createFolder(parent)
    await aliceDrive.openFolder(parent)
    await aliceDrive.createFolder(child)
    await aliceDrive.openFolder(child)

    // Share the child directly.
    await alicePage.getByRole('button', { name: /share/i }).click()
    const modal = new ShareModalPage(alicePage)
    await modal.waitForOpen()
    await modal.addMember(USERS.bob.email)
    await modal.share()

    // The parent itself has no direct sharing: its modal is restricted by
    // the shared child and lists none of the child's recipients.
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.openFolder(parent)

    await alicePage.getByRole('button', { name: /share/i }).click()
    const parentModal = new ShareModalPage(alicePage)
    await parentModal.waitForOpen()

    await expect(
      parentModal.dialog.getByText(/can only be shared by link/i)
    ).toBeVisible()
    await expect(
      parentModal.dialog.getByText(/it contains a shared element/i)
    ).toBeVisible()
    await expect(parentModal.dialog.getByRole('combobox')).toHaveCount(0)
    await expect(parentModal.memberItem('bob')).toHaveCount(0)
    await expect(
      parentModal.dialog.getByRole('button', { name: /^copy link$/i })
    ).toBeVisible()
    await expect(
      parentModal.dialog.getByRole('button', { name: /^done$/i })
    ).toHaveCount(0)

    await parentModal.close()
  })
})
