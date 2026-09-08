import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { trashByName } from '../helpers/stack'
import { ShareModalPage } from '../pages/ShareModalPage'

interface FlagCombo {
  federated: boolean
  hide: boolean
  sharedDrive: boolean
}

const COMBOS: FlagCombo[] = []
for (const federated of [true, false]) {
  for (const hide of [true, false]) {
    for (const sharedDrive of [true, false]) {
      COMBOS.push({ federated, hide, sharedDrive })
    }
  }
}

const comboLabel = (combo: FlagCombo): string =>
  `federated=${combo.federated} hide-cozy-to-cozy=${combo.hide} shared-drive=${combo.sharedDrive}`

const comboFlags = (combo: FlagCombo): Record<string, boolean> => ({
  'drive.federated-shared-folder.enabled': combo.federated,
  'cozy.hide-sharing-cozy-to-cozy': combo.hide,
  'drive.shared-drive.enabled': combo.sharedDrive
})

// The same modal surfaces are asserted for every flag combination. With
// federated on, sharing a folder creates a shared drive and a folder inside
// a shared one shows the only-by-link banner instead of the contact input,
// while keeping the parent's members listed and manageable. With federated
// off, the legacy modal keeps the same banner surfaces but lists direct
// recipients only (shared-drive itself never affects the modal).
for (const combo of COMBOS) {
  // federated=off + hide-cozy-to-cozy=on → the legacy modal renders
  // ShareDialogOnlyByLink for every document: contact sharing is impossible,
  // so the five scenarios cannot even set up. The smoke test pins the
  // degenerate modal instead — re-register the scenarios if sharing becomes
  // possible here again.
  const canShareViaModal = combo.federated || !combo.hide

  test.describe
    .serial(`Nested sharing — share modal surfaces [${comboLabel(combo)}]`, () => {
    // stamp() is monotonic: each combo's describe gets unique names. Declared
    // before the hooks so the afterAll cleanup can trash them.
    const PARENTFOLDER = `Nested Parent ${stamp()}`
    const SUBFOLDER = `Nested Child ${stamp()}`
    const DIRECT_PARENT = `Nested Direct Parent ${stamp()}`
    const SHAREDCHILD_PARENT = `Nested Shared-Child Parent ${stamp()}`

    test.beforeAll(() => {
      setFlags(USERS.alice.instance, {
        ...DEFAULT_FLAGS,
        ...comboFlags(combo)
      })
    })
    test.afterAll(async () => {
      if (canShareViaModal) {
        // Trash the combo's fixtures: each combo leaves shared folders on
        // Alice's instance otherwise, and the accumulation slows down the
        // later specs of the single-worker run. Trashing revokes Bob.
        await trashByName(USERS.alice.instance, PARENTFOLDER)
        await trashByName(USERS.alice.instance, DIRECT_PARENT)
        await trashByName(USERS.alice.instance, SHAREDCHILD_PARENT)
      }
      setFlags(USERS.alice.instance, DEFAULT_FLAGS)
    })

    if (canShareViaModal) {
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

        // Auto-accept is on in the e2e stack, so Bob is a confirmed member
        // and carries the per-member role menu.
        await expect(modal.memberItem('bob')).toBeVisible()
        await expect(modal.memberRole('bob')).toHaveText(/editor/i)

        await modal.close()
      })

      test('child modal of a shared folder', async ({
        alicePage,
        aliceDrive
      }) => {
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
        await expect(
          modal.dialog.getByRole('button', { name: /^copy link$/i })
        ).toBeVisible()
        if (combo.federated) {
          // The federated modal resolves the parent sharing's members.
          await expect(modal.memberItem('bob')).toBeVisible()
          await expect(modal.memberRole('bob')).toHaveText(/editor/i)
          await expect(
            modal.dialog.getByRole('button', { name: /^done$/i })
          ).toHaveCount(0)
        } else {
          // The legacy modal lists direct recipients only — the child
          // inherits none — but its Done button is always rendered.
          await expect(modal.memberItem('bob')).toHaveCount(0)
          await expect(
            modal.dialog.getByRole('button', { name: /^done$/i })
          ).toBeVisible()
        }

        await modal.close()
      })

      test('child modal shared directly', async ({ alicePage, aliceDrive }) => {
        const child = `Nested Direct Child ${stamp()}`

        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.createFolder(DIRECT_PARENT)
        await aliceDrive.openFolder(DIRECT_PARENT)
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

        // After sharing, the modal stays classic and Bob is a confirmed
        // member with a role menu.
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

      test('parent modal of a shared child', async ({
        alicePage,
        aliceDrive
      }) => {
        const child = `Nested Shared-Child Child ${stamp()}`

        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.createFolder(SHAREDCHILD_PARENT)
        await aliceDrive.openFolder(SHAREDCHILD_PARENT)
        await aliceDrive.createFolder(child)
        await aliceDrive.openFolder(child)

        // Share the child directly.
        await alicePage.getByRole('button', { name: /share/i }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()
        await modal.addMember(USERS.bob.email)
        await modal.share()

        // The parent itself has no direct sharing: its modal is restricted
        // by the shared child and lists none of the child's recipients.
        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.openFolder(SHAREDCHILD_PARENT)

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
        if (combo.federated) {
          await expect(
            parentModal.dialog.getByRole('button', { name: /^done$/i })
          ).toHaveCount(0)
        } else {
          // The legacy modal always renders its Done button.
          await expect(
            parentModal.dialog.getByRole('button', { name: /^done$/i })
          ).toBeVisible()
        }

        await parentModal.close()
      })
    } else {
      test('hide cozy-to-cozy forces only-by-link modal', async ({
        alicePage,
        aliceDrive
      }) => {
        const parent = `Nested Only-By-Link ${stamp()}`

        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.createFolder(parent)
        await aliceDrive.openFolder(parent)

        await alicePage.getByRole('button', { name: /share/i }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()

        // No contact sharing at all: no banner text, no contact input,
        // no Done — only the member list and the link affordance.
        await expect(
          modal.dialog.getByText(/can only be shared by link/i)
        ).toHaveCount(0)
        await expect(modal.dialog.getByRole('combobox')).toHaveCount(0)
        await expect(
          modal.dialog.getByRole('button', { name: /^done$/i })
        ).toHaveCount(0)
        await expect(modal.dialog.getByText(/who has access/i)).toBeVisible()
        await expect(modal.dialog.getByRole('listitem').first()).toBeVisible()
        await expect(
          modal.dialog.getByRole('button', { name: /^copy link$/i })
        ).toBeVisible()

        await modal.close()
      })
    }
  })
}
