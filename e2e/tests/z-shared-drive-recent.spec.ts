import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'
import { SidebarPage } from '../pages/SidebarPage'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

// Module-level so these names persist across every serial test in the describe.
const DRIVE_NAME = `Recent Drive ${stamp()}`
// Seeded at setup — Alice trashes this from her own-scope recent view (Variant A).
const ALICE_TRASH_FILE = `recent-alice-trash-${stamp()}.txt`
// Uploaded by Alice in the rename test; renamed live from her recent view (Variant A).
const ALICE_RENAME_FILE = `recent-alice-rename-${stamp()}.txt`
const ALICE_RENAMED = `recent-alice-renamed-${stamp()}.txt`
// Seeded at setup — Bob trashes/renames these from his shared-drive recent view (Variant B).
const BOB_TRASH_FILE = `recent-bob-trash-${stamp()}.txt`
const BOB_RENAME_FILE = `recent-bob-rename-${stamp()}.txt`
const BOB_RENAMED = `recent-bob-renamed-${stamp()}.txt`

test.describe.serial('Shared drive recents', () => {
  // ─── Setup ───────────────────────────────────────────────────────────────
  //
  // Alice creates a shared drive (federated folder), seeds it with three
  // fixture files — one for Alice's trash test, two for Bob's tests — and
  // shares with Bob as Editor so he can trash/rename.

  test('setup: Alice creates and shares a drive seeded with fixture files', async ({
    alicePage,
    aliceDrive
  }) => {
    const aliceTrashPath = path.join(FIXTURE_DIR, ALICE_TRASH_FILE)
    const bobTrashPath = path.join(FIXTURE_DIR, BOB_TRASH_FILE)
    const bobRenamePath = path.join(FIXTURE_DIR, BOB_RENAME_FILE)
    await copyFile(SAMPLE, aliceTrashPath)
    await copyFile(SAMPLE, bobTrashPath)
    await copyFile(SAMPLE, bobRenamePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        role: 'Editor',
        seed: async () => {
          await aliceDrive.uploadFiles([aliceTrashPath, bobTrashPath, bobRenamePath])
          await aliceDrive.row(ALICE_TRASH_FILE).waitVisible()
          await aliceDrive.row(BOB_TRASH_FILE).waitVisible()
          await aliceDrive.row(BOB_RENAME_FILE).waitVisible()
        }
      })
    } finally {
      await safeUnlink(aliceTrashPath)
      await safeUnlink(bobTrashPath)
      await safeUnlink(bobRenamePath)
    }
  })

  // ─── Variant A — OWNER instance (Alice) ──────────────────────────────────
  //
  // Alice accesses the shared drive through her own /folder route (the drive
  // is her own folder). Own-instance realtime is expected to push updates
  // without any manual reload — the whole point of Plan B.

  test('owner (Alice): seeded shared-drive file appears in recent, disappears live on trash', async ({
    alicePage,
    aliceDrive
  }) => {
    // Start at My Drive so the sidebar is rendered, then click Recent.
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await new SidebarPage(alicePage).goToRecent()
    await alicePage.waitForURL(/\/recent/)

    // The seeded file is visible in Alice's own-scope recent without any reload.
    await aliceDrive.row(ALICE_TRASH_FILE).waitVisible({ timeout: 10_000 })

    // Trash from the recent view. sendToTrash() opens the menu, confirms the
    // dialog, and calls waitHidden() internally — the row should vanish live
    // (own-instance realtime), without a manual page reload.
    await aliceDrive.row(ALICE_TRASH_FILE).sendToTrash()
  })

  test('owner (Alice): uploaded shared-drive file renamed live in recent', async ({
    alicePage,
    aliceDrive
  }) => {
    // Upload a second file into the shared-drive folder first so it lands in
    // Alice's own-scope recents, then rename it from the recent view.
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)

    const aliceRenamePath = path.join(FIXTURE_DIR, ALICE_RENAME_FILE)
    await copyFile(SAMPLE, aliceRenamePath)
    try {
      await aliceDrive.uploadFiles(aliceRenamePath)
      await aliceDrive.row(ALICE_RENAME_FILE).waitVisible()

      await new SidebarPage(alicePage).goToRecent()
      await alicePage.waitForURL(/\/recent/)
      await aliceDrive.row(ALICE_RENAME_FILE).waitVisible({ timeout: 10_000 })

      // Rename from the recent view. rename() waits for the new name to be
      // visible in the file list — no reload expected (own-instance realtime).
      await aliceDrive.row(ALICE_RENAME_FILE).rename(ALICE_RENAMED)
    } finally {
      await safeUnlink(aliceRenamePath)
    }
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

  test('recipient (Bob): shared-drive file appears in recent via reload-poll, disappears on trash', async ({
    bobPage,
    bobDrive
  }) => {
    // Open the shared drive once so Bob's instance registers and replicates it
    // (the recipient's drive pouch/realtime subscription is set up on first
    // visit). openSharedDrive waits for the sharing row, then navigates into
    // the proxied /shareddrive/ view.
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)

    // Poll until the shared-drive file surfaces in Bob's /#/recent. Files
    // proxied from Alice's instance may take a few seconds to appear.
    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/recent`)
      await bobDrive.row(BOB_TRASH_FILE).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })

    // Bob trashes from his recent view. sendToTrash() calls waitHidden()
    // internally — the row should disappear once the proxied stack confirms.
    await bobDrive.row(BOB_TRASH_FILE).sendToTrash()
  })

  test('recipient (Bob): shared-drive file renamed from recent is reflected via reload-poll', async ({
    bobPage,
    bobDrive
  }) => {
    // Fresh per-test context: open the shared drive so Bob's instance
    // registers/replicates it before the recent view is checked.
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)

    // Poll until the rename-candidate file appears in Bob's recent view.
    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/recent`)
      await bobDrive.row(BOB_RENAME_FILE).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })

    // Bob renames from his recent view. rename() waits for the new name to
    // be visible in the current file list.
    await bobDrive.row(BOB_RENAME_FILE).rename(BOB_RENAMED)

    // Confirm the rename is durable: reload and check the new name still appears.
    await expect(async () => {
      await bobPage.goto(`${USERS.bob.appUrl}/#/recent`)
      await bobDrive.row(BOB_RENAMED).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })
})
