import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  countFileVersions,
  createFile,
  createFolder,
  fetchFileContent
} from '../helpers/stack'
import { FileViewerPage } from '../pages/FileViewerPage'
import { UploadConflictDialogPage } from '../pages/UploadConflictDialogPage'

const ALICE = USERS.alice

test.describe('Upload over an existing file', () => {
  test('offers Replace, Keep both and Cancel', async ({
    alicePage,
    aliceDrive
  }) => {
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: `Conflict ${stamp()}`
    })
    const stem = `doc-${stamp()}`
    const name = `${stem}.txt`
    const copyName = `${stem} (1).txt`
    const fileId = await createFile({
      instance: ALICE.instance,
      name,
      content: 'first',
      parentId: folderId
    })
    const contentOf = (id: string): Promise<string> =>
      fetchFileContent({ instance: ALICE.instance, fileId: id })
    const upload = (content: string): Promise<void> =>
      aliceDrive.uploadFiles({
        name,
        mimeType: 'text/plain',
        buffer: Buffer.from(content)
      })
    const conflict = new UploadConflictDialogPage(alicePage)

    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    const row = aliceDrive.row(name)
    await row.waitVisible()

    await upload('second')
    await conflict.replace()
    await expect.poll(() => contentOf(fileId)).toBe('second')
    await expect(aliceDrive.matching(stem)).toHaveCount(1)
    expect(await row.fileId()).toBe(fileId)
    expect(await countFileVersions({ instance: ALICE.instance, fileId })).toBe(
      1
    )
    await row.open()
    const viewer = new FileViewerPage(alicePage)
    await viewer.waitForOpen()
    await viewer.expectTextContent('second')
    await viewer.close()

    await upload('third')
    await conflict.keepBoth()
    const copy = aliceDrive.row(copyName)
    await copy.waitVisible()
    expect(await contentOf(await copy.fileId())).toBe('third')
    expect(await contentOf(fileId)).toBe('second')

    await upload('fourth')
    await conflict.cancel()
    await alicePage.reload()
    await copy.waitVisible()
    await expect(aliceDrive.matching(stem)).toHaveCount(2)
    expect(await contentOf(fileId)).toBe('second')
  })
})
