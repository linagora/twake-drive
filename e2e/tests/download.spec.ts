import { execFileSync } from 'child_process'
import { readFile } from 'fs/promises'

import type { Download } from '@playwright/test'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { createFile, createFolder } from '../helpers/stack'

const ALICE = USERS.alice

const savedPath = async (download: Download): Promise<string> => {
  const file = await download.path()
  if (!file) throw new Error(`${download.suggestedFilename()} was not saved`)
  return file
}

/** Files of a ZIP archive, folders left out, sorted. Paths are relative to
 * the archive's root folder, which is named after the archive. */
const zipFiles = async (download: Download): Promise<string[]> =>
  execFileSync('unzip', ['-Z1', await savedPath(download)], {
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .filter(entry => !entry.endsWith('/'))
    .map(entry => entry.split('/').slice(1).join('/'))
    .sort()

test.describe('Download', () => {
  test('downloads a file, its folder and a selection', async ({
    alicePage,
    aliceDrive
  }) => {
    const folder = `Download ${stamp()}`
    const a = `a-${stamp()}.txt`
    const b = `b-${stamp()}.txt`
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: folder
    })
    for (const name of [a, b]) {
      await createFile({
        instance: ALICE.instance,
        name,
        content: `content of ${name}`,
        parentId: folderId
      })
    }

    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row(a).waitVisible()

    const single = await aliceDrive.row(a).download()
    expect(single.suggestedFilename()).toBe(a)
    expect(await readFile(await savedPath(single), 'utf8')).toBe(
      `content of ${a}`
    )

    // The archive name is not asserted: it is files.zip whatever the folder.
    const archive = await aliceDrive.downloadCurrentFolder()
    expect(await zipFiles(archive)).toEqual(
      [a, b].map(name => `${folder}/${name}`).sort()
    )

    await aliceDrive.selectRows([a, b])
    const selection = await aliceDrive.downloadSelection()
    expect(await zipFiles(selection)).toEqual([a, b].sort())
  })
})
