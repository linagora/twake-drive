import { readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { stamp, test } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { createFile, createFolder } from '../helpers/stack'
import { OnlyOfficePage } from '../pages/OnlyOfficePage'

const ALICE = USERS.alice
const PDF_FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.pdf')

test.describe('PDF in OnlyOffice', () => {
  test.beforeAll(() => {
    setFlags(ALICE.instance, {
      ...DEFAULT_FLAGS,
      'drive.onlyoffice.pdf-editing.enabled': true
    })
  })
  test.afterAll(() => {
    // Setting flags merges them: the flag has to be turned off by name
    setFlags(ALICE.instance, {
      ...DEFAULT_FLAGS,
      'drive.onlyoffice.pdf-editing.enabled': false
    })
  })

  test('opens a PDF in OnlyOffice and loads it', async ({
    alicePage,
    aliceDrive
  }) => {
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: `Office PDF ${stamp()}`
    })
    const name = `office-${stamp()}.pdf`
    const fileId = await createFile({
      instance: ALICE.instance,
      name,
      content: await readFile(PDF_FIXTURE),
      contentType: 'application/pdf',
      parentId: folderId
    })

    const office = new OnlyOfficePage(alicePage)
    await office.watchDocumentReady()
    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    await office.openFromRow(aliceDrive.row(name), fileId, 'pdf')
    await office.waitForDocumentReady()
  })
})
