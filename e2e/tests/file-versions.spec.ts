import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  createFile,
  overwriteFile,
  countFileVersions,
  waitForVersionWindow
} from '../helpers/stack'

const ALICE = USERS.alice
const ALICE_ROOT = `${ALICE.appUrl}/#/folder`

/** Build a file with `count` older versions kept by the stack. */
const createFileWithVersions = async (
  name: string,
  count: number
): Promise<string> => {
  const fileId = await createFile({
    instance: ALICE.instance,
    name,
    content: 'version 0'
  })
  for (let i = 1; i <= count; i++) {
    if (i > 1) await waitForVersionWindow()
    await overwriteFile({
      instance: ALICE.instance,
      fileId,
      content: `version ${i}`.repeat(i + 1)
    })
  }
  return fileId
}

test.describe('File versions', () => {
  test('deletes a version from the history modal', async ({
    alicePage,
    aliceDrive
  }) => {
    const name = `versioned-${stamp()}.txt`
    const fileId = await createFileWithVersions(name, 2)
    expect(await countFileVersions({ instance: ALICE.instance, fileId })).toBe(2)

    await alicePage.goto(ALICE_ROOT)
    const row = aliceDrive.row(name)
    await row.waitVisible()

    const menu = await row.openMenu()
    await menu.getByRole('menuitem', { name: /History/ }).click()

    const deleteButtons = alicePage.getByTestId('history-row-delete')
    await expect(deleteButtons).toHaveCount(2)

    await deleteButtons.first().click()
    // `exact` matters: the trash buttons are labelled "Delete this version",
    // which a substring match would pick up alongside the confirm button.
    await alicePage.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(deleteButtons).toHaveCount(1)
    expect(await countFileVersions({ instance: ALICE.instance, fileId })).toBe(1)
  })

  test('offers no delete action on the current version', async ({
    alicePage,
    aliceDrive
  }) => {
    const name = `current-only-${stamp()}.txt`
    await createFileWithVersions(name, 1)

    await alicePage.goto(ALICE_ROOT)
    const row = aliceDrive.row(name)
    await row.waitVisible()

    const menu = await row.openMenu()
    await menu.getByRole('menuitem', { name: /History/ }).click()

    // Two rows are listed — the current version and its single revision — but
    // only the revision can be deleted.
    await expect(alicePage.getByTestId('history-row-download')).toHaveCount(2)
    await expect(alicePage.getByTestId('history-row-delete')).toHaveCount(1)
  })
})
