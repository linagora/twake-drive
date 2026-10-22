import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  makeFilesToken,
  trashById
} from '../helpers/stack'

test('does not claim a later-page mobile file is absent', async ({
  alicePage,
  aliceDrive
}) => {
  const folderId: string = await createFolder({
    instance: USERS.alice.instance,
    name: `Mobile pagination ${stamp()}`
  })
  const names: string[] = Array.from(
    { length: 101 },
    (_, index) => `file-${String(index).padStart(3, '0')}.txt`
  )

  try {
    const token: string = makeFilesToken(USERS.alice.instance)
    for (const name of names) {
      await createFile({
        instance: USERS.alice.instance,
        parentId: folderId,
        name,
        content: name,
        token
      })
    }
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row(names[100]).waitVisible()
    await expect(aliceDrive.row(names[0]).cell).toHaveCount(0)

    await expect(
      aliceDrive.row(names[0]).waitHidden({ timeout: 5_000 })
    ).rejects.toThrow('Expected file "file-000.txt" to be absent')
    await aliceDrive.row(names[0]).waitVisible()
    await aliceDrive.row('not-created.txt').waitHidden()
  } finally {
    await trashById(USERS.alice.instance, folderId)
  }
})

test('accepts absence in an empty mobile folder', async ({
  alicePage,
  aliceDrive
}) => {
  const folderId: string = await createFolder({
    instance: USERS.alice.instance,
    name: `Mobile empty folder ${stamp()}`
  })

  try {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row('not-created.txt').waitHidden()
  } finally {
    await trashById(USERS.alice.instance, folderId)
  }
})
