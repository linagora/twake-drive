import { createHash, randomBytes } from 'crypto'
import { writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'

import type { Page, Request } from '@playwright/test'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { fetchFileMetadataByPath, hasCapability } from '../helpers/stack'
import { UploadQueuePage } from '../pages/UploadQueuePage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`
// Over the 5 MiB under which Drive makes a usual upload, and over the 16 MiB
// part size of the stack, so that the upload has several parts
const SIZE = 20 * 1024 * 1024
// Slow enough for a pause or a cut to land in the middle of the content
const UPLOAD_BYTES_PER_SECOND = 2 * 1024 * 1024

const makeBigFile = async (): Promise<{ filePath: string; md5: string }> => {
  const content = randomBytes(SIZE)
  const filePath = path.join(os.tmpdir(), `resumable-${stamp()}.bin`)
  await writeFile(filePath, content)
  return {
    filePath,
    md5: createHash('md5').update(content).digest('base64')
  }
}

const throttleUploads = async (page: Page): Promise<void> => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: UPLOAD_BYTES_PER_SECOND
  })
}

/** Offsets of the PATCH requests that send the content of an upload. */
const recordPatchOffsets = (page: Page): number[] => {
  const offsets: number[] = []
  page.on('request', (request: Request) => {
    if (request.method() !== 'PATCH' || !request.url().includes('/uploads/')) {
      return
    }
    offsets.push(Number(request.headers()['upload-offset']))
  })
  return offsets
}

/** Methods of the requests that create or resume an upload. */
const recordUploadRequests = (page: Page): string[] => {
  const methods: string[] = []
  page.on('request', (request: Request) => {
    const isCreation = request.headers()['upload-complete'] === '?0'
    const isHead =
      request.method() === 'HEAD' && request.url().includes('/uploads/')
    if (isCreation || isHead) methods.push(request.method())
  })
  return methods
}

const expectStoredMd5 = async (name: string, md5: string): Promise<void> => {
  await expect(async () => {
    const { data } = await fetchFileMetadataByPath({
      instance: USERS.alice.instance,
      path: `/${name}`
    })
    const attributes = data?.attributes as { md5sum?: string } | undefined
    expect(attributes?.md5sum).toBe(md5)
  }).toPass({ timeout: 30_000 })
}

test.describe('Resumable upload', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await hasCapability(USERS.alice.instance, 'resumable_uploads')),
      'The stack does not announce the resumable uploads'
    )
  })

  test.beforeEach(async ({ alicePage }) => {
    setFlags(USERS.alice.instance, {
      ...DEFAULT_FLAGS,
      'drive.resumable-upload.enabled': true
    })
    await alicePage.goto(ALICE_ROOT)
  })

  test.afterEach(() => {
    setFlags(USERS.alice.instance, DEFAULT_FLAGS)
  })

  test('sends a file over the part size in a resumable upload', async ({
    alicePage,
    aliceDrive
  }) => {
    const { filePath, md5 } = await makeBigFile()
    const name = path.basename(filePath)
    const offsets = recordPatchOffsets(alicePage)
    try {
      await aliceDrive.uploadFiles(filePath)
      await aliceDrive.row(name).waitVisible()
      expect(offsets).toEqual([0])
      await expectStoredMd5(name, md5)
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('pauses an upload, lets the next file go, then resumes from the offset', async ({
    alicePage,
    aliceDrive
  }) => {
    await throttleUploads(alicePage)
    const queue = new UploadQueuePage(alicePage)
    const { filePath, md5 } = await makeBigFile()
    const name = path.basename(filePath)
    const offsets = recordPatchOffsets(alicePage)
    const smallPath = path.join(os.tmpdir(), `small-${stamp()}.txt`)
    const smallName = path.basename(smallPath)
    await writeFile(smallPath, 'a small file')
    try {
      await aliceDrive.uploadFiles([filePath, smallPath])
      await queue.waitForItem(name)
      await expect.poll(() => offsets.length).toBe(1)
      await queue.waitForProgress(name, 10)
      await queue.pause(name)
      await expect(queue.getStatusLabel(name, 'paused')).toBeVisible()
      // The paused upload leaves its turn to the next file
      await aliceDrive.row(smallName).waitVisible()
      await expect(queue.getStatusLabel(name, 'paused')).toBeVisible()

      await queue.resume(name)
      await aliceDrive.row(name).waitVisible({ timeout: 30_000 })
      expect(offsets).toHaveLength(2)
      expect(offsets[1]).toBeGreaterThan(0)
      await expectStoredMd5(name, md5)
    } finally {
      await Promise.all([safeUnlink(filePath), safeUnlink(smallPath)])
    }
  })

  test('goes on after a network cut, without starting again', async ({
    alicePage,
    aliceDrive
  }) => {
    await throttleUploads(alicePage)
    const queue = new UploadQueuePage(alicePage)
    const { filePath, md5 } = await makeBigFile()
    const name = path.basename(filePath)
    const offsets = recordPatchOffsets(alicePage)
    const uploadRequests = recordUploadRequests(alicePage)
    try {
      await aliceDrive.uploadFiles(filePath)
      await queue.waitForItem(name)
      await expect.poll(() => offsets.length).toBe(1)
      await queue.waitForProgress(name, 10)
      await alicePage.context().setOffline(true)
      await expect(queue.getStatusLabel(name, 'offline')).toBeVisible()

      await alicePage.context().setOffline(false)
      await aliceDrive.row(name).waitVisible({ timeout: 30_000 })
      expect(offsets.length).toBeGreaterThanOrEqual(2)
      // The same upload goes on from the offset of the stack: one creation,
      // then a HEAD before each new PATCH. A reconnection right after the cut
      // can find an offset of 0, when the stack has not saved the bytes of
      // the cut request yet.
      expect(uploadRequests[0]).toBe('POST')
      expect(uploadRequests.slice(1)).toEqual(
        Array(offsets.length - 1).fill('HEAD')
      )
      await expectStoredMd5(name, md5)
    } finally {
      await safeUnlink(filePath)
    }
  })
})
