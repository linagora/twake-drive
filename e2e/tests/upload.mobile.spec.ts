import path from 'path'

import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { createFolder, trashById } from '../helpers/stack'

const SAMPLE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')

test('uploads into an empty mobile folder', async ({
  alicePage,
  aliceDrive
}) => {
  const folderId: string = await createFolder({
    instance: USERS.alice.instance,
    name: `Mobile upload ${stamp()}`
  })

  try {
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${folderId}`)
    await expect(aliceDrive.fileList).toContainText(
      'Select files on your device.'
    )
    await expect(aliceDrive.fileList).toHaveCount(1)
    await aliceDrive.uploadFiles(SAMPLE)
    await aliceDrive.row('sample.txt').waitVisible()
  } finally {
    await trashById(USERS.alice.instance, folderId)
  }
})
