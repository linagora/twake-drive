import { readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { escapeRegExp, expect, stamp, test } from '../helpers/fixtures'
import { waitForSharingRow } from '../helpers/sharing'
import { createFile } from '../helpers/stack'
import { OnlyOfficePage } from '../pages/OnlyOfficePage'

const DOCX_FIXTURE = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'office-sample.docx'
)
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

test('shares an Office document from its editor', async ({
  alicePage,
  aliceDrive,
  bobPage,
  bobDrive
}) => {
  const name = `Shared from editor ${stamp()}.docx`
  const fileId = await createFile({
    instance: USERS.alice.instance,
    name,
    content: await readFile(DOCX_FIXTURE),
    contentType: DOCX_MIME
  })
  await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
  const office = new OnlyOfficePage(alicePage)
  await office.openFromRow(aliceDrive.row(name), fileId)

  const modal = await office.openShareModal()
  await modal.addMember(USERS.bob.email)
  await modal.share()

  await expect(alicePage).toHaveURL(
    new RegExp(`/onlyoffice/${escapeRegExp(fileId)}`)
  )
  await waitForSharingRow(bobPage, USERS.bob, bobDrive, name)
})
