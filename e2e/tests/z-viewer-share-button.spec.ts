import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { waitForSharingRow } from '../helpers/sharing'
import { createFile, createFolder } from '../helpers/stack'
import { FileViewerPage } from '../pages/FileViewerPage'

test.describe('Share button of the new viewer', () => {
  test.beforeAll(() => {
    setFlags(USERS.alice.instance, {
      ...DEFAULT_FLAGS,
      'drive.new-file-viewer-ui.enabled': true
    })
  })
  test.afterAll(() => {
    setFlags(USERS.alice.instance, DEFAULT_FLAGS)
  })

  test('shares the viewed file with Bob', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    const folderId = await createFolder({
      instance: USERS.alice.instance,
      name: `Viewer share ${stamp()}`
    })
    const name = `viewer-share-${stamp()}.txt`
    await createFile({
      instance: USERS.alice.instance,
      name,
      content: name,
      parentId: folderId
    })
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row(name).open()
    const viewer = new FileViewerPage(alicePage)
    await viewer.waitForOpen()

    const modal = await viewer.openShareFromButton()
    await expect(alicePage).toHaveURL(/\/file\/[^/]+\/v\/share$/)
    await modal.addMember(USERS.bob.email)
    await modal.share()

    await waitForSharingRow(bobPage, USERS.bob, bobDrive, name)
  })
})
