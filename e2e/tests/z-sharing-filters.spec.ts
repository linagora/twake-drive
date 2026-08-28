import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { expect, safeUnlink, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  waitForSharingRow
} from '../helpers/sharing'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')
const DOCUMENT_NAME = `filtered-reshare-${stamp()}.txt`
const FOLDER_NAME = `Filtered Reshare Folder ${stamp()}`
const DOCUMENT_MARKER = 'before-reshare'

test.describe.serial('Filtered federated re-sharing', () => {
  test('Alice shares a document and a folder with Bob', async ({
    alicePage,
    aliceDrive
  }) => {
    const documentPath = path.join(FIXTURE_DIR, DOCUMENT_NAME)
    await copyFile(SAMPLE, documentPath)
    try {
      await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
      await aliceDrive.uploadFiles(documentPath)
      const documentRow = aliceDrive.row(DOCUMENT_NAME)
      await documentRow.waitVisible()

      const shareModal = await documentRow.share()
      await shareModal.addMember(USERS.bob.email)
      await shareModal.share()
    } finally {
      await safeUnlink(documentPath)
    }

    await createAndShareFolderWithBob(alicePage, aliceDrive, FOLDER_NAME)
  })

  test('Bob keeps his folder filter while re-sharing live with Charlie', async ({
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, DOCUMENT_NAME)
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, FOLDER_NAME)

    await charliePage.goto(`${USERS.charlie.appUrl}/#/sharings/with-me`)
    await expect(charliePage.getByTestId('sharings-filters')).toBeVisible()
    await expect(charlieDrive.row(FOLDER_NAME).cell).toHaveCount(0)
    await charliePage.locator('html').evaluate((root, marker) => {
      root.dataset.e2eDocumentMarker = marker
    }, DOCUMENT_MARKER)

    await bobPage.getByRole('button', { name: 'Type', exact: true }).click()
    await bobPage.getByRole('option', { name: 'Folders' }).click()

    await expect(bobPage).toHaveURL(
      /#\/sharings\/with-me\?f\.type=directory$/
    )
    await expect(
      bobPage.getByRole('button', { name: 'Folders', exact: true })
    ).toBeVisible()
    await expect(bobDrive.row(FOLDER_NAME).cell).toBeVisible()
    await expect(bobDrive.row(DOCUMENT_NAME).cell).toHaveCount(0)

    const shareModal = await bobDrive.row(FOLDER_NAME).share()
    await expect(bobPage).toHaveURL(
      /#\/sharings\/with-me\/shareddrive\/[^/]+\/[^/]+\/share\?f\.type=directory$/
    )
    await shareModal.addMember(USERS.charlie.email)
    await shareModal.share()

    await expect(bobPage).toHaveURL(
      /#\/sharings\/with-me\?f\.type=directory$/
    )
    await expect(
      bobPage.getByRole('button', { name: 'Folders', exact: true })
    ).toBeVisible()
    await expect(bobDrive.row(FOLDER_NAME).cell).toBeVisible()
    await expect(bobDrive.row(DOCUMENT_NAME).cell).toHaveCount(0)

    await expect(charlieDrive.row(FOLDER_NAME).cell).toBeVisible({
      timeout: 30_000
    })
    await expect(charliePage).toHaveURL(/#\/sharings\/with-me$/)
    await expect(charliePage.locator('html')).toHaveAttribute(
      'data-e2e-document-marker',
      DOCUMENT_MARKER
    )
  })
})
