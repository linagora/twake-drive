import { readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { extractPdfText } from '../helpers/pdf'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'
import {
  createPdfFile,
  fetchFileBinary,
  trashById,
  trashByName
} from '../helpers/stack'
import { OnlyOfficePdfPage } from '../pages/OnlyOfficePdfPage'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'

const PDF_FIXTURE = path.join(
  __dirname,
  '..',
  'fixtures',
  'onlyoffice-editable.pdf'
)
const normalizePdfText = (text: string): string => text.replace(/\s+/g, '')
const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder/io.cozy.files.root-dir`

async function expectOwnerPdfText(
  fileId: string,
  marker: string
): Promise<void> {
  await expect
    .poll(
      async () => {
        const pdf = await extractPdfText(
          await fetchFileBinary({ instance: USERS.alice.instance, fileId })
        )
        expect(pdf.pageCount).toBe(1)
        expect(normalizePdfText(pdf.text)).toContain('ORIGINAL-PDF-CONTENT')
        return normalizePdfText(pdf.text)
      },
      { timeout: 90_000, intervals: [1000, 2000, 5000] }
    )
    .toContain(marker)
}

test('Bob edits Alice PDF in a received federated folder', async ({
  alicePage,
  aliceDrive,
  bobPage,
  bobDrive
}) => {
  test.setTimeout(300_000)
  const folderName = `onlyoffice-shared-${stamp()}`
  const fileName = `federated-${stamp()}.pdf`
  const marker = `PDFBOB${stamp().replace(/\D/g, '')}`
  let folderId = ''
  let fileId = ''

  try {
    await createAndShareFolderWithBob(alicePage, aliceDrive, folderName, {
      role: 'Editor',
      seed: async () => {
        folderId = alicePage.url().match(/\/folder\/([^/?#]+)/)?.[1] ?? ''
        expect(folderId).not.toBe('')
        fileId = await createPdfFile({
          instance: USERS.alice.instance,
          dirId: folderId,
          name: fileName,
          content: await readFile(PDF_FIXTURE)
        })
      }
    })
    expect(fileId).not.toBe('')
    const initial = await extractPdfText(
      await fetchFileBinary({ instance: USERS.alice.instance, fileId })
    )
    expect(initial.pageCount).toBe(1)
    expect(normalizePdfText(initial.text)).toContain('ORIGINAL-PDF-CONTENT')
    expect(normalizePdfText(initial.text)).not.toContain(marker)

    await openSharedDrive(bobPage, USERS.bob, bobDrive, folderName)
    const bobRow = bobDrive.row(fileName)
    await bobRow.waitVisible()
    await bobRow.open()
    const bobEditor = new OnlyOfficePdfPage(bobPage, 'E2E Bob')
    await bobEditor.waitForOpen(fileId)
    await bobEditor.insertText(marker)
    await bobEditor.save()
    await bobEditor.close('about:blank')

    await expectOwnerPdfText(fileId, marker)

    await openSharedDrive(bobPage, USERS.bob, bobDrive, folderName)
    await bobDrive.row(fileName).open()
    await bobEditor.waitForOpen(fileId)
    await bobEditor.expectTextVisible(marker)
    await bobEditor.close('about:blank')

    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, folderName)
    await aliceDrive.row(fileName).open()
    const aliceEditor = new OnlyOfficePdfPage(alicePage)
    await aliceEditor.waitForOpen(fileId)
    await aliceEditor.expectTextVisible(marker)
    await aliceEditor.close('about:blank')
  } finally {
    await bobPage.goto('about:blank')
    await alicePage.goto('about:blank')
    if (folderId) {
      await trashById(USERS.alice.instance, folderId)
    } else {
      await trashByName(USERS.alice.instance, folderName)
    }
  }
})

test('anonymous editor changes Alice PDF through a direct link', async ({
  alicePage,
  aliceDrive,
  publicPage
}) => {
  test.setTimeout(300_000)
  const fileName = `public-${stamp()}.pdf`
  const marker = `PDFPUBLIC${stamp().replace(/\D/g, '')}`
  const fileId = await createPdfFile({
    instance: USERS.alice.instance,
    name: fileName,
    content: await readFile(PDF_FIXTURE)
  })
  try {
    const initial = await extractPdfText(
      await fetchFileBinary({ instance: USERS.alice.instance, fileId })
    )
    expect(initial.pageCount).toBe(1)
    expect(normalizePdfText(initial.text)).toContain('ORIGINAL-PDF-CONTENT')
    expect(normalizePdfText(initial.text)).not.toContain(marker)

    await alicePage
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])
    await alicePage.goto(ALICE_ROOT)
    const row = aliceDrive.row(fileName)
    await row.waitVisible()
    const modal = await row.share()
    const link = new ShareByLinkPage(alicePage)
    const url = await link.createLink()
    await modal.close()
    await row.share()
    await link.waitForLinkRow()
    await link.allowEditing()

    await publicPage.goto(url)
    const visitorEditor = new OnlyOfficePdfPage(publicPage, 'E2E Visitor')
    await visitorEditor.waitForOpen(fileId)
    await visitorEditor.insertText(marker)
    await visitorEditor.save()
    await visitorEditor.close('about:blank')

    await expectOwnerPdfText(fileId, marker)

    await publicPage.goto(url)
    await visitorEditor.waitForOpen(fileId)
    await visitorEditor.expectTextVisible(marker)
    await visitorEditor.close('about:blank')

    await alicePage.goto(ALICE_ROOT)
    await aliceDrive.row(fileName).open()
    const aliceEditor = new OnlyOfficePdfPage(alicePage)
    await aliceEditor.waitForOpen(fileId)
    await aliceEditor.expectTextVisible(marker)
    await aliceEditor.close('about:blank')
  } finally {
    await publicPage.goto('about:blank')
    await alicePage.goto('about:blank')
    await trashById(USERS.alice.instance, fileId)
  }
})
