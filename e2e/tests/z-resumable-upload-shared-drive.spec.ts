import { createHash, randomBytes } from 'crypto'
import { writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { createAndShareFolderWithBob, openSharedDrive } from '../helpers/sharing'
import { fetchFileMetadataByPath, hasCapability } from '../helpers/stack'
import { UploadQueuePage } from '../pages/UploadQueuePage'

// Over the 5 MiB under which Drive makes a usual upload, and over the 16 MiB
// part size of the stack, so that the upload has several parts
const SIZE = 20 * 1024 * 1024
const DRIVE_NAME = `Resumable Drive ${stamp()}`

// Shared across .serial tests in this describe — do not enable fullyParallel.
test.describe.serial('Resumable upload to a shared drive', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await hasCapability(USERS.alice.instance, 'resumable_uploads')),
      'The stack does not announce the resumable uploads'
    )
  })

  test('Alice shares a drive', async ({ alicePage, aliceDrive }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME)
  })

  test('Bob pauses and resumes an upload to the drive', async ({
    bobPage,
    bobDrive
  }) => {
    setFlags(USERS.bob.instance, {
      ...DEFAULT_FLAGS,
      'drive.resumable-upload.enabled': true
    })
    const content = randomBytes(SIZE)
    const filePath = path.join(os.tmpdir(), `drive-resumable-${stamp()}.bin`)
    await writeFile(filePath, content)
    const name = path.basename(filePath)
    const patches: { url: string; offset: number }[] = []
    bobPage.on('request', request => {
      if (request.method() !== 'PATCH') return
      patches.push({
        url: new URL(request.url()).pathname,
        offset: Number(request.headers()['upload-offset'])
      })
    })
    try {
      await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
      const cdp = await bobPage.context().newCDPSession(bobPage)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: 2 * 1024 * 1024
      })
      const queue = new UploadQueuePage(bobPage)
      await bobDrive.uploadFiles(filePath)
      await queue.waitForItem(name)
      await expect.poll(() => patches.length).toBe(1)
      await queue.waitForProgress(name, 10)
      await queue.pause(name)
      await expect(queue.getStatusLabel(name, 'paused')).toBeVisible()
      await queue.resume(name)
      await bobDrive.row(name).waitVisible({ timeout: 30_000 })

      expect(patches).toHaveLength(2)
      expect(patches[0].url).toMatch(/^\/sharings\/drives\/[^/]+\/uploads\//)
      await expect(async () => {
        const { data } = await fetchFileMetadataByPath({
          instance: USERS.alice.instance,
          path: `/${DRIVE_NAME}/${name}`
        })
        const attributes = data?.attributes as { md5sum?: string } | undefined
        expect(attributes?.md5sum).toBe(
          createHash('md5').update(content).digest('base64')
        )
      }).toPass({ timeout: 30_000 })
    } finally {
      setFlags(USERS.bob.instance, DEFAULT_FLAGS)
      await safeUnlink(filePath)
    }
  })
})
