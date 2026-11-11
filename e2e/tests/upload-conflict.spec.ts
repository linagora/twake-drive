import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  countFileVersions,
  createFile,
  createFolder,
  fetchFileContent,
  fetchFileMetadataByPath
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

  test('one Replace applies to every conflicting file of an upload', async ({
    alicePage,
    aliceDrive
  }) => {
    const folder = `Conflict batch ${stamp()}`
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: folder
    })
    const stem = `batch-${stamp()}`
    const names = [`${stem}-a.txt`, `${stem}-b.txt`]
    const fileIds: string[] = []
    for (const name of names) {
      fileIds.push(
        await createFile({
          instance: ALICE.instance,
          name,
          content: 'before',
          parentId: folderId
        })
      )
    }

    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row(names[1]).waitVisible()
    await aliceDrive.uploadFiles(
      names.map(name => ({
        name,
        mimeType: 'text/plain',
        buffer: Buffer.from(`after ${name}`)
      }))
    )
    // Asked once: a second dialog would hold the second file back
    await new UploadConflictDialogPage(alicePage).replace()

    for (const [index, name] of names.entries()) {
      await expect
        .poll(() =>
          fetchFileContent({ instance: ALICE.instance, fileId: fileIds[index] })
        )
        .toBe(`after ${name}`)
    }
    // Both uploads are done: none of them left a "(1)" copy on the stack
    for (const name of names) {
      const copy = await fetchFileMetadataByPath({
        instance: ALICE.instance,
        path: `/${folder}/${name.replace(/\.txt$/, ' (1).txt')}`
      })
      expect(copy.status).toBe(404)
    }
  })
})
