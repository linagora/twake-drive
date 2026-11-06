import { USERS } from '../helpers/config'
import { test, expect, stamp, escapeRegExp } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { t } from '../helpers/i18n'
import { openSharedDrive } from '../helpers/sharing'
import { trashByName } from '../helpers/stack'
import { DowngradeConfirmDialogPage } from '../pages/DowngradeConfirmDialogPage'
import { ShareModalPage } from '../pages/ShareModalPage'

interface FlagCombo {
  federated: boolean
  hide: boolean
  sharedDrive: boolean
}

const SHARE_BUTTON = new RegExp(
  escapeRegExp(t('cozy-sharing:Files.share.cta')),
  'i'
)
const ONLY_BY_LINK = new RegExp(
  escapeRegExp(
    t('cozy-sharing:Files.share.shareByEmail.onlyByLink', {
      type: t('cozy-sharing:Files.share.shareByEmail.type.folder')
    })
  ),
  'i'
)
const HAS_SHARED_CHILD = new RegExp(
  escapeRegExp(t('cozy-sharing:Files.share.shareByEmail.hasSharedChild')),
  'i'
)
const WHO_HAS_ACCESS = new RegExp(
  escapeRegExp(t('cozy-sharing:Share.contacts.whoHasAccess')),
  'i'
)
const COPY_LINK = new RegExp(
  `^${escapeRegExp(t('cozy-sharing:Files.share.shareByLink.copy'))}$`,
  'i'
)
const EDITOR = new RegExp(
  escapeRegExp(t('cozy-sharing:Share.type.two-way')),
  'i'
)
const VIEWER = new RegExp(
  escapeRegExp(t('cozy-sharing:Share.type.one-way')),
  'i'
)
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
// federated on, the hasSharedParent/hasSharedChild gates are gone: a folder
// stays shareable by email even inside a shared parent or containing a
// shared child, and the modal lists effective recipients (direct +
// inherited), all manageable — role/revoke actions on an inherited member
// are routed to the source sharing. With federated off, the legacy modal
// keeps the banner surfaces and lists direct recipients only (shared-drive
// itself never affects the modal).
// Each combination sets and resets its flags in its own serial describe, so
// the combinations can spread across workers and shards instead of forming
// one long group.
test.describe.configure({ mode: 'parallel' })

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
    const RECIPIENT_PARENT = `Nested Recipient Parent ${stamp()}`
    const BOTH_SHARED_PARENT = `Nested Both-Shared Parent ${stamp()}`

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
        if (combo.federated) {
          await trashByName(USERS.alice.instance, RECIPIENT_PARENT)
          await trashByName(USERS.alice.instance, BOTH_SHARED_PARENT)
        }
      }
      setFlags(USERS.alice.instance, DEFAULT_FLAGS)
    })

    if (canShareViaModal) {
      test('parent modal before sharing', async ({ alicePage, aliceDrive }) => {
        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.createFolder(PARENTFOLDER)
        await aliceDrive.openFolder(PARENTFOLDER)

        await aliceDrive.createFolder(SUBFOLDER)

        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()

        // Not shared and no shared child: the classic modal.
        await expect(modal.dialog.getByText(ONLY_BY_LINK)).toHaveCount(0)
        await expect(modal.dialog.getByRole('combobox')).toBeVisible()
        await expect(modal.dialog.getByRole('listitem').first()).toBeVisible()
        await expect(
          modal.dialog.getByRole('button', { name: COPY_LINK })
        ).toBeVisible()
        await expect(modal.shareButton).toBeVisible()

        await modal.addMember(USERS.bob.email)
        await modal.share()
      })

      test('parent modal after sharing shows members with permission menu', async ({
        alicePage,
        aliceDrive
      }) => {
        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.openFolder(PARENTFOLDER)

        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()

        // Auto-accept is on in the e2e stack, so Bob is a confirmed member
        // and carries the per-member role menu.
        await expect(modal.memberItem('bob')).toBeVisible()
        await expect(modal.memberRole('bob')).toHaveText(EDITOR)

        await modal.close()
      })

      test('child modal of a shared folder', async ({
        alicePage,
        aliceDrive
      }) => {
        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.openFolder(PARENTFOLDER)
        await aliceDrive.openFolder(SUBFOLDER)

        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()

        await expect(
          modal.dialog.getByRole('button', { name: COPY_LINK })
        ).toBeVisible()
        if (combo.federated) {
          // The federated modal lists the parent's members as inherited
          // effective recipients, all manageable, and keeps email sharing
          // available: the hasSharedParent gate is gone.
          await expect(modal.dialog.getByText(ONLY_BY_LINK)).toHaveCount(0)
          await expect(modal.dialog.getByRole('combobox')).toBeVisible()
          await expect(modal.memberItem('bob')).toBeVisible()
          await expect(modal.memberRole('bob')).toHaveText(EDITOR)
          await expect(modal.shareButton).toBeVisible()

          // Demoting an inherited member from the child's modal also lowers
          // their rights on the shared parent, so it opens a confirmation
          // dialog naming both folders. Cancelling keeps the role.
          await modal.selectMemberRole('bob', 'Viewer')
          const confirmDialog = new DowngradeConfirmDialogPage(alicePage)
          await confirmDialog.waitForOpen()
          await expect(confirmDialog.contactName()).toHaveText('bob')
          await expect(confirmDialog.folderRow(PARENTFOLDER)).toBeVisible()
          await expect(confirmDialog.folderRow(SUBFOLDER)).toBeVisible()

          await confirmDialog.cancel()
          await expect(modal.memberRole('bob')).toHaveText(EDITOR)

          // Confirming applies the change to the parent sharing the member
          // comes from.
          await modal.selectMemberRole('bob', 'Viewer')
          await confirmDialog.waitForOpen()
          await confirmDialog.confirm()
          await expect(modal.memberRole('bob')).toHaveText(VIEWER)
          await modal.close()

          await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
          await aliceDrive.openFolder(PARENTFOLDER)
          await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
          const parentModal = new ShareModalPage(alicePage)
          await parentModal.waitForOpen()
          await expect(parentModal.memberRole('bob')).toHaveText(VIEWER)
          await parentModal.close()
        } else {
          // The legacy modal keeps the gate: email sharing is blocked and it
          // lists direct recipients only — the child inherits none.
          await expect(modal.dialog.getByText(ONLY_BY_LINK)).toBeVisible()
          await expect(modal.dialog.getByRole('combobox')).toHaveCount(0)
          await expect(modal.memberItem('bob')).toHaveCount(0)

          await modal.close()
        }
      })

      if (combo.federated) {
        test('recipient keeps the full modal on a subfolder they create themselves', async ({
          alicePage,
          aliceDrive,
          bobPage,
          bobDrive
        }) => {
          await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
          await aliceDrive.createFolder(RECIPIENT_PARENT)
          await aliceDrive.openFolder(RECIPIENT_PARENT)

          await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
          const shareModal = new ShareModalPage(alicePage)
          await shareModal.waitForOpen()
          await shareModal.addMember(USERS.bob.email)
          await shareModal.share()

          await openSharedDrive(bobPage, USERS.bob, bobDrive, RECIPIENT_PARENT)
          const childName = `Nested Recipient Child ${stamp()}`
          await bobDrive.createFolder(childName)
          await bobDrive.row(childName).waitVisible({ timeout: 10_000 })
          const parentDriveUrl = bobPage.url()
          await bobDrive.row(childName).open()
          await expect.poll(() => bobPage.url()).not.toBe(parentDriveUrl)
          await expect(
            bobPage.locator('main').getByRole('navigation').first()
          ).toContainText(childName)
          const childFolderUrl = bobPage.url()

          // No Share trigger reaches a subfolder from here without
          // drive.virtualization.enabled; go straight to its share route.
          await bobPage.goto(`${childFolderUrl}/share`)
          const modal = new ShareModalPage(bobPage)
          await modal.waitForOpen()

          await expect(modal.dialog.getByRole('combobox')).toBeVisible()
          await expect(modal.shareButton).toBeVisible()
          await expect(modal.dialog.getByText(ONLY_BY_LINK)).toHaveCount(0)
          await expect(
            modal.dialog.getByRole('button', { name: COPY_LINK })
          ).toBeVisible()

          await modal.close()
        })
      }

      if (combo.federated) {
        test('downgrading a member shared on both the child and its parent lowers both', async ({
          alicePage,
          aliceDrive
        }) => {
          const child = `Nested Both-Shared Child ${stamp()}`

          await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
          await aliceDrive.createFolder(BOTH_SHARED_PARENT)
          await aliceDrive.openFolder(BOTH_SHARED_PARENT)

          const parentShareModal = await aliceDrive.openShareModal()
          await parentShareModal.addMember(USERS.bob.email)
          await parentShareModal.share()

          await aliceDrive.createFolder(child)
          await aliceDrive.openFolder(child)

          const childShareModal = await aliceDrive.openShareModal()
          await childShareModal.addMember(USERS.bob.email)
          await childShareModal.share()

          // Bob is the child's only recipient, and still editor through the
          // parent: confirming must downgrade him on both sharings, or the
          // effective role flips back to editor.
          const modal = await aliceDrive.openShareModal()
          await expect(modal.memberRole('bob')).toHaveText(EDITOR)
          await modal.selectMemberRole('bob', 'Viewer')
          const confirmDialog = new DowngradeConfirmDialogPage(alicePage)
          await confirmDialog.waitForOpen()
          await confirmDialog.confirm()
          await expect(modal.memberRole('bob')).toHaveText(VIEWER)
          await modal.close()

          const reopenedModal = await aliceDrive.openShareModal()
          await expect(reopenedModal.memberRole('bob')).toHaveText(VIEWER)
          await reopenedModal.close()

          await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
          await aliceDrive.openFolder(BOTH_SHARED_PARENT)
          const parentModal = await aliceDrive.openShareModal()
          await expect(parentModal.memberRole('bob')).toHaveText(VIEWER)
          await parentModal.close()
        })
      }

      test('child modal shared directly', async ({ alicePage, aliceDrive }) => {
        const child = `Nested Direct Child ${stamp()}`

        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.createFolder(DIRECT_PARENT)
        await aliceDrive.openFolder(DIRECT_PARENT)
        await aliceDrive.createFolder(child)
        await aliceDrive.openFolder(child)

        // Before sharing: no shared parent, no shared child — classic modal.
        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()

        await expect(modal.dialog.getByText(ONLY_BY_LINK)).toHaveCount(0)
        await expect(modal.dialog.getByRole('combobox')).toBeVisible()
        await expect(modal.dialog.getByRole('listitem').first()).toBeVisible()
        await expect(modal.memberItem('bob')).toHaveCount(0)
        await expect(
          modal.dialog.getByRole('button', { name: COPY_LINK })
        ).toBeVisible()
        await expect(modal.shareButton).toBeVisible()

        await modal.addMember(USERS.bob.email)
        await modal.share()

        // After sharing, the modal stays classic and Bob is a confirmed
        // member with a role menu.
        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const sharedModal = new ShareModalPage(alicePage)
        await sharedModal.waitForOpen()

        await expect(sharedModal.dialog.getByText(ONLY_BY_LINK)).toHaveCount(0)
        await expect(sharedModal.dialog.getByRole('combobox')).toBeVisible()
        await expect(sharedModal.memberItem('bob')).toBeVisible()
        await expect(sharedModal.memberRole('bob')).toHaveText(EDITOR)
        await expect(
          sharedModal.dialog.getByRole('button', { name: COPY_LINK })
        ).toBeVisible()
        await expect(sharedModal.shareButton).toBeVisible()

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
        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()
        await modal.addMember(USERS.bob.email)
        await modal.share()

        // The parent itself has no direct sharing, and the child share
        // grants no access to it: Bob is not an effective recipient of it.
        await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
        await aliceDrive.openFolder(SHAREDCHILD_PARENT)

        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const parentModal = new ShareModalPage(alicePage)
        await parentModal.waitForOpen()

        await expect(parentModal.memberItem('bob')).toHaveCount(0)
        await expect(
          parentModal.dialog.getByRole('button', { name: COPY_LINK })
        ).toBeVisible()
        if (combo.federated) {
          // The hasSharedChild gate is gone: the parent stays shareable by
          // email, with no banner.
          await expect(parentModal.dialog.getByText(ONLY_BY_LINK)).toHaveCount(
            0
          )
          await expect(
            parentModal.dialog.getByText(HAS_SHARED_CHILD)
          ).toHaveCount(0)
          await expect(parentModal.dialog.getByRole('combobox')).toBeVisible()
          await expect(parentModal.shareButton).toBeVisible()

          // The newly allowed flow: share the parent by email anyway.
          await parentModal.addMember(USERS.charlie.email)
          await parentModal.share()

          await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
          const resharedModal = new ShareModalPage(alicePage)
          await resharedModal.waitForOpen()
          await expect(resharedModal.memberItem('charlie')).toBeVisible()
          await expect(resharedModal.memberItem('bob')).toHaveCount(0)
          await resharedModal.close()
        } else {
          // The legacy modal keeps the gate: restricted by the shared child.
          await expect(parentModal.dialog.getByText(ONLY_BY_LINK)).toBeVisible()
          await expect(
            parentModal.dialog.getByText(HAS_SHARED_CHILD)
          ).toBeVisible()
          await expect(parentModal.dialog.getByRole('combobox')).toHaveCount(0)

          await parentModal.close()
        }
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

        await alicePage.getByRole('button', { name: SHARE_BUTTON }).click()
        const modal = new ShareModalPage(alicePage)
        await modal.waitForOpen()

        // No contact sharing at all: no banner text, no contact input,
        // no Share button — only the member list and the link affordance.
        await expect(modal.dialog.getByText(ONLY_BY_LINK)).toHaveCount(0)
        await expect(modal.dialog.getByRole('combobox')).toHaveCount(0)
        await expect(modal.shareButton).toHaveCount(0)
        await expect(modal.dialog.getByText(WHO_HAS_ACCESS)).toBeVisible()
        await expect(modal.dialog.getByRole('listitem').first()).toBeVisible()
        await expect(
          modal.dialog.getByRole('button', { name: COPY_LINK })
        ).toBeVisible()

        await modal.close()
      })
    }
  })
}
