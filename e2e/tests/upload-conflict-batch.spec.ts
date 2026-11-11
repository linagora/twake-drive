import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { createFile, createFolder, fetchFileContent } from '../helpers/stack'
import { UploadConflictDialogPage } from '../pages/UploadConflictDialogPage'

const ALICE = USERS.alice

test('one Replace applies to every conflicting file of an upload', async ({
  alicePage,
  aliceDrive
}) => {
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: `Conflict batch ${stamp()}`
  })
  const names = [`first-${stamp()}.txt`, `second-${stamp()}.txt`]
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
})
