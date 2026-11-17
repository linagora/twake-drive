import { readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { stamp, test } from '../helpers/fixtures'
import { createFile, createFolder } from '../helpers/stack'
import { OnlyOfficePage } from '../pages/OnlyOfficePage'
import { PublicLinkPage } from '../pages/PublicLinkPage'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'

const DOCX_FIXTURE = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'office-sample.docx'
)
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

test('opens an Office document of a public link in OnlyOffice', async ({
  alicePage,
  aliceDrive,
  publicPage
}) => {
  await alicePage
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'])
  const folderId = await createFolder({
    instance: USERS.alice.instance,
    name: `Public Office ${stamp()}`
  })
  const name = `Public document ${stamp()}.docx`
  const fileId = await createFile({
    instance: USERS.alice.instance,
    name,
    content: await readFile(DOCX_FIXTURE),
    contentType: DOCX_MIME,
    parentId: folderId
  })

  await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${folderId}`)
  await aliceDrive.row(name).waitVisible()
  const modal = await aliceDrive.openShareModal()
  const url = await new ShareByLinkPage(alicePage).createLink()
  await modal.close()

  const office = new OnlyOfficePage(publicPage)
  await office.watchDocumentReady()
  await publicPage.goto(url)
  await office.openFromRow(new PublicLinkPage(publicPage).row(name), fileId)
  await office.waitForDocumentReady()
})
