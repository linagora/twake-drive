import { execFileSync } from 'child_process'
import { writeFile } from 'fs/promises'

import type { Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'
import {
  countFileVersions,
  createFolder,
  fetchFileBytes
} from '../helpers/stack'
import { OnlyOfficePage } from '../pages/OnlyOfficePage'

const ALICE = USERS.alice

/** Text of the document body of the .docx as the stack stores it. */
const storedDocxText = async (fileId: string): Promise<string> => {
  const docx = test.info().outputPath(`${fileId}.docx`)
  await writeFile(
    docx,
    await fetchFileBytes({ instance: ALICE.instance, fileId })
  )
  return execFileSync('unzip', ['-p', docx, 'word/document.xml'], {
    encoding: 'utf8'
  }).replace(/<[^>]+>/g, '')
}

const openNewFolder = async (page: Page): Promise<void> => {
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: `Office ${stamp()}`
  })
  await page.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
}

test.describe('OnlyOffice editing', () => {
  test('creates a text document, edits it and the edit is saved', async ({
    alicePage,
    aliceDrive
  }) => {
    await openNewFolder(alicePage)
    const fileId = await aliceDrive.createOfficeDocument('text')
    const office = new OnlyOfficePage(alicePage)
    await office.waitForTextEditor('Alice')

    const word = `Saved${stamp().replace(/\W/g, '')}`
    await office.type(`${word} `)
    await office.back()
    const row = aliceDrive.row(`${t('OnlyOffice.createFileName.text')}.docx`)
    await row.waitVisible()

    await expect
      .poll(() => storedDocxText(fileId), { timeout: 60_000 })
      .toContain(word)
    expect(
      await countFileVersions({ instance: ALICE.instance, fileId })
    ).toBeGreaterThan(0)

    await office.openFromRow(row, fileId)
  })

  test('creates a spreadsheet and a presentation from the Create menu', async ({
    alicePage,
    aliceDrive
  }) => {
    await openNewFolder(alicePage)
    const office = new OnlyOfficePage(alicePage)
    for (const [kind, extension] of [
      ['spreadsheet', 'xlsx'],
      ['slide', 'pptx']
    ] as const) {
      await aliceDrive.createOfficeDocument(kind)
      await office.back()
      await aliceDrive
        .row(`${t(`OnlyOffice.createFileName.${kind}`)}.${extension}`)
        .waitVisible()
    }
  })
})
