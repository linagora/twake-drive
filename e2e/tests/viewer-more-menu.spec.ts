import { readFile } from 'fs/promises'

import type { Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  countFileVersions,
  createFile,
  createFolder,
  overwriteFile
} from '../helpers/stack'
import type { DrivePage } from '../pages/DrivePage'
import { FileViewerPage } from '../pages/FileViewerPage'
import { SidebarPage } from '../pages/SidebarPage'

const ALICE = USERS.alice

interface ViewedFile {
  folderUrl: string
  name: string
  content: string
  fileId: string
  viewer: FileViewerPage
}

/** Create a file alone in a new folder and open it in the viewer. */
const openInViewer = async (
  page: Page,
  drive: DrivePage,
  prefix: string
): Promise<ViewedFile> => {
  const folderId = await createFolder({
    instance: ALICE.instance,
    name: `Viewer ${prefix} ${stamp()}`
  })
  const name = `viewer-${prefix}-${stamp()}.txt`
  const content = `content of ${name}`
  const fileId = await createFile({
    instance: ALICE.instance,
    name,
    content,
    parentId: folderId
  })
  const folderUrl = `${ALICE.appUrl}/#/folder/${folderId}`
  await page.goto(folderUrl)
  await drive.row(name).open()
  const viewer = new FileViewerPage(page)
  await viewer.waitForOpen()
  return { folderUrl, name, content, fileId, viewer }
}

test.describe('More menu of the viewer', () => {
  test('downloads the file', async ({ alicePage, aliceDrive }) => {
    const { name, content, viewer } = await openInViewer(
      alicePage,
      aliceDrive,
      'download'
    )

    const download = await viewer.downloadFromMenu()

    expect(download.suggestedFilename()).toBe(name)
    expect(await readFile(await download.path(), 'utf8')).toBe(content)
  })

  test('duplicates the file next to it', async ({ alicePage, aliceDrive }) => {
    const { folderUrl, name, viewer } = await openInViewer(
      alicePage,
      aliceDrive,
      'duplicate'
    )

    await viewer.duplicateFromMenu()
    // Going back would reopen the route of the picker
    await alicePage.goto(folderUrl)

    await expect(aliceDrive.matching(name.replace(/\.txt$/, ''))).toHaveCount(2)
  })

  test('adds the file to the favorites', async ({ alicePage, aliceDrive }) => {
    const { name, viewer } = await openInViewer(
      alicePage,
      aliceDrive,
      'favorite'
    )

    await viewer.addToFavoritesFromMenu()
    await viewer.close()

    await new SidebarPage(alicePage).goToFavorites()
    await expect(aliceDrive.row(name).cell).toBeVisible()
  })

  test('lists the versions of the file', async ({ alicePage, aliceDrive }) => {
    const { fileId, viewer } = await openInViewer(
      alicePage,
      aliceDrive,
      'versions'
    )
    await overwriteFile({
      instance: ALICE.instance,
      fileId,
      content: 'second version'
    })
    expect(await countFileVersions({ instance: ALICE.instance, fileId })).toBe(
      1
    )

    // The current version and the former one
    await expect(await viewer.openHistoryFromMenu()).toHaveCount(2)
  })

  test('sends the file to the Bin and leaves the viewer', async ({
    alicePage,
    aliceDrive
  }) => {
    const { name, viewer } = await openInViewer(alicePage, aliceDrive, 'trash')

    await viewer.trashFromMenu()

    await alicePage.waitForURL(url => !/\/file\/[^/]+/.test(url.toString()))
    await aliceDrive.row(name).waitHidden()
    await new SidebarPage(alicePage).goToTrash()
    await expect(aliceDrive.row(name).cell).toBeVisible()
  })
})
