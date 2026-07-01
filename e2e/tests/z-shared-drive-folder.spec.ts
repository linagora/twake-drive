import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

// Module-level so these names persist across every serial test in the describe.
const DRIVE_NAME = `Folder Drive ${stamp()}`
// Seeded at setup — Alice trashes/renames these from her folder view (Variant A).
const ALICE_TRASH_FILE = `folder-alice-trash-${stamp()}.txt`
const ALICE_RENAME_FILE = `folder-alice-rename-${stamp()}.txt`
const ALICE_RENAMED = `folder-alice-renamed-${stamp()}.txt`
// Seeded at setup — Bob trashes/renames these from his shared-drive folder view (Variant B).
const BOB_TRASH_FILE = `folder-bob-trash-${stamp()}.txt`
const BOB_RENAME_FILE = `folder-bob-rename-${stamp()}.txt`
const BOB_RENAMED = `folder-bob-renamed-${stamp()}.txt`

test.describe.serial('Shared drive folder live updates', () => {
  // ─── Setup ───────────────────────────────────────────────────────────────
  //
  // Alice creates a shared drive (federated folder), seeds it with four
  // fixture files — two for Alice's tests, two for Bob's tests — and
  // shares with Bob as Editor so he can rename/trash.

  test('setup: Alice creates and shares a drive seeded with fixture files', async ({
    alicePage,
    aliceDrive
  }) => {
    const aliceTrashPath = path.join(FIXTURE_DIR, ALICE_TRASH_FILE)
    const aliceRenamePath = path.join(FIXTURE_DIR, ALICE_RENAME_FILE)
    const bobTrashPath = path.join(FIXTURE_DIR, BOB_TRASH_FILE)
    const bobRenamePath = path.join(FIXTURE_DIR, BOB_RENAME_FILE)
    await copyFile(SAMPLE, aliceTrashPath)
    await copyFile(SAMPLE, aliceRenamePath)
    await copyFile(SAMPLE, bobTrashPath)
    await copyFile(SAMPLE, bobRenamePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        role: 'Editor',
        seed: async () => {
          await aliceDrive.uploadFiles([
            aliceTrashPath,
            aliceRenamePath,
            bobTrashPath,
            bobRenamePath
          ])
          await aliceDrive.row(ALICE_TRASH_FILE).waitVisible()
          await aliceDrive.row(ALICE_RENAME_FILE).waitVisible()
          await aliceDrive.row(BOB_TRASH_FILE).waitVisible()
          await aliceDrive.row(BOB_RENAME_FILE).waitVisible()
        }
      })
    } finally {
      await safeUnlink(aliceTrashPath)
      await safeUnlink(aliceRenamePath)
      await safeUnlink(bobTrashPath)
      await safeUnlink(bobRenamePath)
    }
  })

  // ─── Variant A — OWNER instance (Alice) ──────────────────────────────────
  //
  // Alice accesses the shared drive through her own /folder route (the drive
  // is her own folder). Own-instance realtime is expected to push updates
  // without any manual reload — the whole point of Plan C.

  test('owner (Alice): seeded file disappears live on trash inside folder view', async ({
    alicePage,
    aliceDrive
  }) => {
    // Navigate into the shared-drive folder on Alice's own instance. The drive
    // is her own folder, so it renders on the regular /folder route — there is
    // no proxied /shareddrive view on the owner's side.
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)

    // The seeded file is visible without a reload — Alice owns this folder.
    await aliceDrive.row(ALICE_TRASH_FILE).waitVisible({ timeout: 10_000 })

    // Trash from the folder view. sendToTrash() opens the More menu, clicks
    // /^remove$/i, confirms the dialog, and calls waitHidden() internally —
    // the row should vanish live (own-instance realtime), without a manual
    // page reload.
    await aliceDrive.row(ALICE_TRASH_FILE).sendToTrash()
  })

  test('owner (Alice): file renamed live inside folder view', async ({
    alicePage,
    aliceDrive
  }) => {
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)

    // The seeded file is visible without a reload.
    await aliceDrive.row(ALICE_RENAME_FILE).waitVisible({ timeout: 10_000 })

    // Rename from the folder view. rename() waits for the new name to be
    // visible in the current file list — no reload expected (own-instance
    // realtime).
    await aliceDrive.row(ALICE_RENAME_FILE).rename(ALICE_RENAMED)
  })

  // ─── Variant B — RECIPIENT instance (Bob) ────────────────────────────────
  //
  // Bob accesses files through the proxied /shareddrive route on his instance.
  // Cross-instance propagation (Alice → Bob) is not pushed live by the CI
  // stack, so a reload-and-poll pattern is used instead of relying on the
  // per-drive realtime socket push.
  //
  // Note: true no-reload live updates for the recipient depend on the per-drive
  // realtime socket being delivered to Bob's stack (Plan A Phase 3). That push
  // may not fire in the CI stack. The reload-poll keeps these tests stable
  // while still validating that the reactive store path produces the correct
  // end state once the data arrives from Alice's instance.

  test('recipient (Bob): shared-drive file appears in folder view via reload-poll, disappears on trash', async ({
    bobPage,
    bobDrive
  }) => {
    // Open the shared drive so Bob's instance registers and replicates it.
    // openSharedDrive polls the Sharings tab until the row shows up, then
    // navigates into the proxied /shareddrive/ folder view.
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)

    // Poll until the seeded file appears in Bob's folder view. Files proxied
    // from Alice's instance may take a few seconds to replicate.
    await expect(async () => {
      await bobPage.reload()
      await bobDrive.row(BOB_TRASH_FILE).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })

    // Bob trashes from his shared-drive folder view. sendToTrash() opens the
    // More menu (/^remove$/i), confirms the dialog, and calls waitHidden()
    // internally — the row should disappear once the proxied stack confirms.
    // Note: the /^remove$/i confirm-button label is hardcoded in FileRow; on a
    // proxied /shareddrive route the menu/dialog label may differ if the
    // recipient UI diverges — update FileRow.sendToTrash if that happens.
    await bobDrive.row(BOB_TRASH_FILE).sendToTrash()
  })

  test('recipient (Bob): shared-drive file renamed from folder view is reflected via reload-poll', async ({
    bobPage,
    bobDrive
  }) => {
    // Fresh per-test context: open the shared drive so Bob's instance
    // registers/replicates it before the folder view is checked.
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)

    // Poll until the rename-candidate file appears in Bob's folder view.
    await expect(async () => {
      await bobPage.reload()
      await bobDrive.row(BOB_RENAME_FILE).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })

    // Bob renames from his shared-drive folder view. rename() waits for the
    // new name to be visible in the current file list.
    await bobDrive.row(BOB_RENAME_FILE).rename(BOB_RENAMED)

    // Confirm the rename is durable: reload and check the new name still appears.
    await expect(async () => {
      await bobPage.reload()
      await bobDrive.row(BOB_RENAMED).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })
})
