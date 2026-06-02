import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import { FileViewerPage } from '../pages/FileViewerPage'
import { UploadQueuePage } from '../pages/UploadQueuePage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`
const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')
const NOTES = path.join(FIXTURE_DIR, 'notes.txt')

test.describe('Upload & file viewer', () => {
  test('uploads a single file via the Upload button', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const uniqueName = `sample-${stamp()}.txt`
    const fixturePath = path.join(FIXTURE_DIR, uniqueName)
    await copyFile(SAMPLE, fixturePath)
    try {
      await aliceDrive.uploadFiles(fixturePath)
      await aliceDrive.row(uniqueName).waitVisible()
    } finally {
      await safeUnlink(fixturePath)
    }
  })

  test('uploads several files and watches the queue', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const queue = new UploadQueuePage(alicePage)
    const a = path.join(FIXTURE_DIR, `a-${stamp()}.txt`)
    const b = path.join(FIXTURE_DIR, `b-${stamp()}.txt`)
    await copyFile(SAMPLE, a)
    await copyFile(NOTES, b)
    try {
      await aliceDrive.uploadFiles([a, b])
      await queue.waitForOpen()
      await queue.waitForItem(path.basename(a))
      await queue.waitForItem(path.basename(b))
      await aliceDrive.row(path.basename(a)).waitVisible()
      await aliceDrive.row(path.basename(b)).waitVisible()
    } finally {
      await Promise.all([safeUnlink(a), safeUnlink(b)])
    }
  })

  test('uploads a file via the right-click context menu', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    // Operate inside a fresh, empty folder so the right-click lands on blank
    // space (the AddMenu) rather than a file row (the file menu).
    const folder = `CtxUpload ${stamp()}`
    await aliceDrive.createFolder(folder)
    await aliceDrive.row(folder).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)

    const uniqueName = `ctx-${stamp()}.txt`
    const fixturePath = path.join(FIXTURE_DIR, uniqueName)
    await copyFile(SAMPLE, fixturePath)
    try {
      await aliceDrive.uploadFilesViaContextMenu(fixturePath)
      await aliceDrive.row(uniqueName).waitVisible()
    } finally {
      await safeUnlink(fixturePath)
    }
  })

  test('uploads a file by dragging it onto the dropzone', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const folder = `DragDrop ${stamp()}`
    await aliceDrive.createFolder(folder)
    await aliceDrive.row(folder).open()
    await alicePage.waitForURL(/\/folder\/[^/]+$/)

    const fileName = `dropped-${stamp()}.txt`
    await aliceDrive.dropFiles([
      { name: fileName, mime: 'text/plain', content: 'dropped via DnD' }
    ])
    await aliceDrive.row(fileName).waitVisible()
  })

  test('opens an uploaded file in the viewer and closes it', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const viewer = new FileViewerPage(alicePage)
    const file = path.join(FIXTURE_DIR, `viewable-${stamp()}.txt`)
    await copyFile(SAMPLE, file)
    try {
      const fileName = path.basename(file)
      await aliceDrive.uploadFiles(file)
      const row = aliceDrive.row(fileName)
      await row.waitVisible()
      await row.open()
      await viewer.waitForOpen()
      await viewer.close()
      await expect(row.cell).toBeVisible()
    } finally {
      await safeUnlink(file)
    }
  })
})
