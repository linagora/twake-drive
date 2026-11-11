import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { waitForSharingRow } from '../helpers/sharing'
import { createFile } from '../helpers/stack'

// Shared across .serial tests in this describe — do not enable fullyParallel.
const FILE_NAME = `file-root-${stamp()}.txt`

test.describe.serial('Sharing of a file shared alone (owner)', () => {
  test('Alice shares a file with Bob from its row menu', async ({
    alicePage,
    aliceDrive
  }) => {
    await createFile({
      instance: USERS.alice.instance,
      name: FILE_NAME,
      content: FILE_NAME
    })
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    const modal = await aliceDrive.row(FILE_NAME).share()
    await modal.addMember(USERS.bob.email)
    await modal.share()
  })

  test('Alice adds Charlie from her Sharings list and Charlie gets the file', async ({
    alicePage,
    aliceDrive,
    charliePage,
    charlieDrive
  }) => {
    await waitForSharingRow(
      alicePage,
      USERS.alice,
      aliceDrive,
      FILE_NAME,
      'by-me'
    )

    const modal = await aliceDrive.row(FILE_NAME).share()
    await expect(alicePage).toHaveURL(/\/sharings\/by-me\/share\//)
    await expect(modal.memberItem(USERS.bob.email)).toBeVisible()
    await modal.addMember(USERS.charlie.email)
    await modal.share()

    await waitForSharingRow(charliePage, USERS.charlie, charlieDrive, FILE_NAME)
  })
})
