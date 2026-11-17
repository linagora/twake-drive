import { readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  fetchFileMetadataByPath,
  trashById
} from '../helpers/stack'
import { OnlyOfficePage } from '../pages/OnlyOfficePage'

const ALICE = USERS.alice
const DOCX_FIXTURE = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'office-sample.docx'
)
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

test('warns the editor when the document goes to the Bin, and restores it', async ({
  alicePage,
  aliceDrive
}) => {
  const folder = `Office deleted ${stamp()}`
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: folder
  })
  const name = `Deleted ${stamp()}.docx`
  const fileId = await createFile({
    instance: ALICE.instance,
    name,
    content: await readFile(DOCX_FIXTURE),
    contentType: DOCX_MIME,
    parentId: folderId
  })
  await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
  const office = new OnlyOfficePage(alicePage)
  await office.openFromRow(aliceDrive.row(name), fileId)
  await office.waitForTextEditor('Alice')
  await expect(office.deletedNotice).toHaveCount(0)

  await trashById(ALICE.instance, fileId)

  await expect(office.deletedNotice).toBeVisible({ timeout: 30_000 })
  await office.restoreDeletedFile()
  await expect
    .poll(
      async () =>
        (
          await fetchFileMetadataByPath({
            instance: ALICE.instance,
            path: `/${folder}/${name}`
          })
        ).status
    )
    .toBe(200)
})
