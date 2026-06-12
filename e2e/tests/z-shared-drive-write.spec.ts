import { copyFile } from 'fs/promises'
import path from 'path'

import type { Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive,
  openOwnerFolder
} from '../helpers/sharing'
import type { FileRow } from '../pages/FileRow'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

// Shared across .serial tests in this describe — do not enable fullyParallel.
const DRIVE_NAME = `Write Drive ${stamp()}`
const SEED_FILE = `write-seed-${stamp()}.txt`
const BOB_FILE = `write-bob-${stamp()}.txt`
const BOB_FOLDER = `Write Bob Folder ${stamp()}`
const ALICE_FILE = `write-alice-${stamp()}.txt`
const BLINK_FILES = [1, 2, 3].map(n => `write-blink-${n}-${stamp()}.txt`)

/** The loading skeleton FolderViewBody swaps in for the file list. The CSS
 * module hashes a suffix onto the class, so match on the stable stem. */
const placeholder = (page: Page): ReturnType<Page['locator']> =>
  page.locator('[class*="fil-content-file-placeholder"]')

/**
 * Watch rows appear without the list ever dismounting: the skeleton must
 * never show and rows that became visible must stay visible (regression
 * guard for the shared-drive upload blink, where every refetch flashed the
 * whole list back to the skeleton). Non-retrying assertions on purpose —
 * a blink between polls is missable in theory, but the regression showed
 * the skeleton for the better part of each refetch, far wider than the
 * polling interval.
 */
async function expectRowsToSettleWithoutBlink(
  page: Page,
  rows: FileRow[],
  timeoutMs = 20_000
): Promise<void> {
  if (rows.length === 0) {
    throw new Error('expectRowsToSettleWithoutBlink needs at least one row')
  }
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    expect(await placeholder(page).count()).toBe(0)
    const visible = (
      await Promise.all(rows.map(row => row.cell.isVisible()))
    ).filter(Boolean).length
    expect(visible).toBeGreaterThanOrEqual(seen)
    seen = visible
    if (visible === rows.length) return
    if (Date.now() >= deadline) {
      // Surface which row never showed instead of a bare timestamp assertion.
      await Promise.all(
        rows.map(row => expect(row.cell).toBeVisible({ timeout: 1_000 }))
      )
      return
    }
    await page.waitForTimeout(80)
  }
}

test.describe.serial('Shared drive write flows (recipient)', () => {
  test('Alice shares a drive seeded with one file', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, SEED_FILE)
    await copyFile(SAMPLE, filePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(SEED_FILE).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('the blink guard still keys on the real skeleton class', async ({
    bobPage,
    bobDrive
  }) => {
    // Self-check for the guard below: expectRowsToSettleWithoutBlink asserts
    // the skeleton class is absent, so if that CSS-module class is renamed the
    // placeholder() locator would silently match nothing and the guard would
    // pass vacuously forever. Catching the transient skeleton live is racy, so
    // instead assert the class still exists in the loaded styles — deterministic
    // and it fails loudly the day the class is renamed.
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(SEED_FILE).waitVisible({ timeout: 10_000 })
    const classPresent = await bobPage.evaluate(() =>
      Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule =>
            rule.cssText.includes('fil-content-file-placeholder')
          )
        } catch {
          // Cross-origin sheet — not ours, skip it.
          return false
        }
      })
    )
    expect(classPresent).toBe(true)
  })

  test('Bob uploads into the drive root without the list blinking', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(SEED_FILE).waitVisible({ timeout: 10_000 })

    const filePath = path.join(FIXTURE_DIR, BOB_FILE)
    await copyFile(SAMPLE, filePath)
    try {
      // Recipient uploads go through the proxied
      // POST /sharings/drives/:id endpoint on Bob's own stack.
      await bobDrive.uploadFiles(filePath)
      await expectRowsToSettleWithoutBlink(bobPage, [
        bobDrive.row(SEED_FILE),
        bobDrive.row(BOB_FILE)
      ])
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('Bob creates a folder and Alice sees both of his additions', async ({
    bobPage,
    bobDrive,
    alicePage,
    aliceDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.createFolder(BOB_FOLDER)

    // Owner side: Bob's writes land on Alice's instance (the drive is her own
    // folder, so she sees them in My Drive).
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
    await expect(async () => {
      await alicePage.reload()
      await aliceDrive.row(BOB_FILE).waitVisible({ timeout: 5_000 })
      await aliceDrive.row(BOB_FOLDER).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })

  test("Alice's upload shows up in Bob's drive view", async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(SEED_FILE).waitVisible({ timeout: 10_000 })

    const filePath = path.join(FIXTURE_DIR, ALICE_FILE)
    await copyFile(SAMPLE, filePath)
    try {
      // Alice uploads into her own folder (the drive's backing storage).
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, DRIVE_NAME)
      await aliceDrive.uploadFiles(filePath)
      await aliceDrive.row(ALICE_FILE).waitVisible()

      // The recipient's view is a live proxy of Alice's instance, so a reload
      // reflects her upload. (Owner->recipient websocket push exists but isn't
      // delivered by the CI stack, so we don't depend on a push here.)
      await expect(async () => {
        await bobPage.reload()
        await bobDrive.row(ALICE_FILE).waitVisible({ timeout: 5_000 })
      }).toPass({ timeout: 30_000 })
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('uploads into an empty drive folder never flash the skeleton', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(BOB_FOLDER).waitVisible({ timeout: 10_000 })
    await bobDrive.row(BOB_FOLDER).open()

    // Wait for the empty folder's settled state before uploading, so the
    // assertion below can't trip on the legitimate first-load skeleton.
    await expect(bobPage.getByText(/drag them here/i)).toBeVisible({
      timeout: 10_000
    })

    const filePaths = BLINK_FILES.map(name => path.join(FIXTURE_DIR, name))
    try {
      await Promise.all(filePaths.map(p => copyFile(SAMPLE, p)))
      // The original bug: in an empty shared-drive folder every uploaded
      // file flipped the list back to the skeleton. Upload several at once
      // and require the rows to only ever accumulate.
      await bobDrive.uploadFiles(filePaths)
      await expectRowsToSettleWithoutBlink(
        bobPage,
        BLINK_FILES.map(name => bobDrive.row(name))
      )
    } finally {
      await Promise.all(filePaths.map(p => safeUnlink(p)))
    }
  })
})
