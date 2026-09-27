import { readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { test, expect, stamp } from '../helpers/fixtures'
import { extractPdfText } from '../helpers/pdf'
import { createPdfFile, fetchFileBinary, trashById } from '../helpers/stack'
import { OnlyOfficePdfPage } from '../pages/OnlyOfficePdfPage'

const PDF_FIXTURE = path.join(
  __dirname,
  '..',
  'fixtures',
  'onlyoffice-editable.pdf'
)
const normalizePdfText = (text: string): string => text.replace(/\s+/g, '')

test.skip(
  !process.env.COZY_E2E_STACK_IMAGE,
  'PDF editing requires an explicitly selected Stack image with Office PDF support'
)

test.beforeEach(() => {
  setFlags(USERS.alice.instance, {
    ...DEFAULT_FLAGS,
    'drive.office.enabled': true,
    'drive.office.write': true,
    'drive.office.pdf.enabled': true
  })
})

test.afterEach(() => {
  setFlags(USERS.alice.instance, DEFAULT_FLAGS)
})

test('Alice edits a personal PDF and sees it after reopening', async ({
  alicePage,
  aliceDrive
}) => {
  test.setTimeout(180_000)
  const name = `onlyoffice-personal-${stamp()}.pdf`
  const marker = `PDFE2E${stamp().replace(/\D/g, '')}`
  const instance = USERS.alice.instance
  const fileId = await createPdfFile({
    instance,
    name,
    content: await readFile(PDF_FIXTURE)
  })

  try {
    const before = await extractPdfText(
      await fetchFileBinary({ instance, fileId })
    )
    expect(before.pageCount).toBe(1)
    expect(normalizePdfText(before.text)).toContain('ORIGINAL-PDF-CONTENT')
    expect(normalizePdfText(before.text)).not.toContain(marker)

    await alicePage.goto(
      `${USERS.alice.appUrl}/#/folder/io.cozy.files.root-dir`
    )
    const row = aliceDrive.row(name)
    await row.waitVisible()
    await row.open()

    const editor = new OnlyOfficePdfPage(alicePage)
    await editor.waitForOpen(fileId)
    await editor.insertText(marker)
    await editor.save()
    await editor.close()

    await expect
      .poll(
        async () =>
          normalizePdfText(
            (
              await extractPdfText(await fetchFileBinary({ instance, fileId }))
            ).text
          ),
        { timeout: 90_000, intervals: [1000, 2000, 5000] }
      )
      .toContain(marker)

    await row.waitVisible()
    await row.open()
    await editor.waitForOpen(fileId)
    await editor.expectTextVisible(marker)
    await editor.close()
  } finally {
    await alicePage.goto(
      `${USERS.alice.appUrl}/#/folder/io.cozy.files.root-dir`
    )
    await trashById(instance, fileId)
  }
})
