import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { t } from '../helpers/i18n'
import { createFile, createFolder } from '../helpers/stack'

const ALICE = USERS.alice

test.describe('Right-click menu', () => {
  test('acts on the right-clicked file only, not on the former selection', async ({
    alicePage,
    aliceDrive
  }) => {
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: `Right click ${stamp()}`
    })
    const selected = `right-click-selected-${stamp()}.txt`
    const clicked = `right-click-target-${stamp()}.txt`
    for (const name of [selected, clicked]) {
      await createFile({
        instance: ALICE.instance,
        name,
        content: name,
        parentId: folderId
      })
    }

    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row(selected).select()

    // One menu, opened while the other file is still selected
    const items = await aliceDrive.row(clicked).sendToTrashFromContextMenu()

    expect(items).toEqual(
      expect.arrayContaining([
        t('SelectionBar.download'),
        t('SelectionBar.rename'),
        t('SelectionBar.trash')
      ])
    )
    await expect(aliceDrive.row(selected).cell).toBeVisible()
  })
})
