import { readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { createFile, createFolder, fetchFileContent } from '../helpers/stack'
import { DrivePage } from '../pages/DrivePage'
import { OnlyOfficePage } from '../pages/OnlyOfficePage'
import { UploadConflictDialogPage } from '../pages/UploadConflictDialogPage'

const ALICE = USERS.alice
const DOCX_FIXTURE = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'office-sample.docx'
)
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

test('warns the editor when the document changes outside OnlyOffice', async ({
  alicePage,
  aliceDrive
}) => {
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: `Office diverged ${stamp()}`
  })
  const name = `Diverged ${stamp()}.docx`
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
  await expect(office.divergedNotice).toHaveCount(0)

  // Alice replaces the file from another tab of Drive meanwhile
  const otherTab = await alicePage.context().newPage()
  try {
    await otherTab.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    const otherDrive = new DrivePage(otherTab)
    await otherDrive.row(name).waitVisible()
    await otherDrive.uploadFiles({
      name,
      mimeType: DOCX_MIME,
      buffer: Buffer.from('replaced outside the editor')
    })
    await new UploadConflictDialogPage(otherTab).replace()
    await expect
      .poll(() => fetchFileContent({ instance: ALICE.instance, fileId }))
      .toBe('replaced outside the editor')
  } finally {
    await otherTab.close()
  }

  await expect(office.divergedNotice).toBeVisible({ timeout: 30_000 })
})
