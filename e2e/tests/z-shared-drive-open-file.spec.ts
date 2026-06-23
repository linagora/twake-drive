import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import {
  test,
  expect,
  stamp,
  safeUnlink,
  escapeRegExp
} from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import { FileViewerPage } from '../pages/FileViewerPage'

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures')
const SAMPLE = path.join(FIXTURE_DIR, 'sample.txt')

// Shared across .serial tests — names lead with a stable, short token because
// the breadcrumb truncates the tail.
const DRIVE_PREFIX = 'OpenFileDrive'
const DRIVE_NAME = `${DRIVE_PREFIX}-${stamp()}`
const FILE_NAME = `open-file-${stamp()}.txt`

// A recipient has no local copy of a shared-drive file: its document lives on
// the owner's instance and is reached through the /sharings/drives proxy. The
// regression this guards (DRIVE recents/search routing) made the recipient open
// the file via the local /files/:id route, which 404s. Opening it here proves
// the recipient path resolves to the proxied /shareddrive viewer and the
// content is fetched through the drive proxy, not the local files API.
test.describe.serial('Shared drive file open (recipient)', () => {
  test('Alice shares a folder containing a file', async ({
    alicePage,
    aliceDrive
  }) => {
    const filePath = path.join(FIXTURE_DIR, FILE_NAME)
    await copyFile(SAMPLE, filePath)
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, DRIVE_NAME, {
        seed: async () => {
          await aliceDrive.uploadFiles(filePath)
          await aliceDrive.row(FILE_NAME).waitVisible()
        }
      })
    } finally {
      await safeUnlink(filePath)
    }
  })

  test('Bob opens the shared-drive file through the proxy', async ({
    bobPage,
    bobDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DRIVE_NAME)
    await bobDrive.row(FILE_NAME).waitVisible({ timeout: 10_000 })

    // Open the file and capture the body request atomically: the viewer creates
    // its download link via POST /sharings/drives/<driveId>/downloads. Awaiting
    // both in one Promise.all means the response budget covers the action, not
    // the slower viewer/route waits that follow.
    const viewer = new FileViewerPage(bobPage)
    const [proxiedDownload] = await Promise.all([
      bobPage.waitForResponse(
        res => /\/sharings\/drives\/[^/]+\/downloads/.test(res.url()),
        { timeout: 20_000 }
      ),
      bobDrive.row(FILE_NAME).open()
    ])
    expect(proxiedDownload.ok()).toBeTruthy()

    await viewer.waitForOpen()

    // The route stays scoped to the shared drive — a local /folder or /recent
    // file route here would mean the file resolved to the recipient's own
    // (empty) files API and 404'd.
    await bobPage.waitForURL(/\/shareddrive\/[^/]+\/[^/]+\/file\/[^/]+/)

    // The viewer mounted the proxied file: its title is the filename, set once
    // the proxied folder query loads (a second round-trip, so allow for proxy
    // latency rather than the default expect timeout).
    await expect(bobPage).toHaveTitle(new RegExp(escapeRegExp(FILE_NAME)), {
      timeout: 15_000
    })
  })
})
