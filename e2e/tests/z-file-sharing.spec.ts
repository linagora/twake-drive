import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import { PublicLinkPage } from '../pages/PublicLinkPage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`
const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

// Shared across .serial tests in this describe — do not enable fullyParallel.
// Picked at runtime per run so the test doesn't trip over leftovers from a
// previous execution and so Bob's sharings tab (where everything is flat) has
// a unique target to wait for.
const FILE_NAME = `shared-file-${stamp()}.txt`

test.describe.serial('File sharing (federated)', () => {
  test('Alice uploads a file and shares it with Bob from the row menu', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    // Upload a file with a unique name so the row's anchored matcher can't
    // collide with leftovers from a previous run.
    const filePath = path.join(FIXTURE_DIR, FILE_NAME)
    await copyFile(SAMPLE, filePath)
    try {
      await aliceDrive.uploadFiles(filePath)
      const row = aliceDrive.row(FILE_NAME)
      await row.waitVisible()

      // Open the row's kebab menu and click "Share". This is the same
      // ShareFileView modal used for a regular file share; on the cozy-stack
      // it creates a file-root shared drive (drive_root_type: file) rather
      // than a plain permission because the sharing collection treats a
      // single file share as a drive when the federated flag is on.
      const shareModal = await row.share()
      await shareModal.addMember(USERS.bob.email)
      await shareModal.share()
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('Bob sees the file in his Sharings tab', async ({
    bobPage,
    bobDrive
  }) => {
    await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)

    // Sharing propagates asynchronously across instances; reload until the
    // federated shortcut lands in the Sharings list.
    await expect(async () => {
      await bobPage.reload()
      await bobDrive.row(FILE_NAME).waitVisible({ timeout: 5_000 })
    }).toPass({ timeout: 30_000 })
  })

  test('Bob opens the shared file from his Sharings tab', async ({
    bobPage,
    bobDrive
  }) => {
    await bobPage.goto(`${USERS.bob.appUrl}/#/sharings`)
    const row = bobDrive.row(FILE_NAME)
    await row.waitVisible()

    await row.open()

    // The shared-file shortcut opens its owner's public viewer, so assert
    // the shared content is actually rendered rather than checking the URL.
    await new PublicLinkPage(bobPage).expectFileContent(
      'hello from twake-drive e2e'
    )
  })
})
