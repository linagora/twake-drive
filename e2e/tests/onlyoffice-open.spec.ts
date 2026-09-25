import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { test, stamp, safeUnlink } from '../helpers/fixtures'
import { OnlyOfficePage } from '../pages/OnlyOfficePage'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const DOCX_FIXTURE = path.join(FIXTURE_DIR, 'office-sample.docx')

test('opens a personal Word document in OnlyOffice', async ({
  alicePage,
  aliceDrive
}) => {
  const name = `Office document ${stamp()}.docx`
  const filePath = path.join(FIXTURE_DIR, name)
  await copyFile(DOCX_FIXTURE, filePath)

  try {
    setFlags(USERS.alice.instance, {
      ...DEFAULT_FLAGS,
      'drive.office.enabled': true,
      'drive.office.write': true
    })

    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.uploadFiles(filePath)
    const row = aliceDrive.row(name)
    await row.waitVisible()

    const fileId = await row.fileId()
    await new OnlyOfficePage(alicePage).openFromRow(row, fileId)
  } finally {
    setFlags(USERS.alice.instance, DEFAULT_FLAGS)
    await safeUnlink(filePath)
  }
})
