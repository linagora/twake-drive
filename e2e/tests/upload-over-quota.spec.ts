import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { getDiskQuota, setDiskQuota } from '../helpers/quota'
import { createFolder, fetchFileMetadataByPath } from '../helpers/stack'
import { QuotaPaywallPage } from '../pages/QuotaPaywallPage'

const ALICE = USERS.alice

test.describe('Upload over the disk quota', () => {
  let previousQuota: number | null = null

  test.beforeAll(async () => {
    previousQuota = await getDiskQuota(ALICE.instance)
  })
  test.afterAll(async () => {
    await setDiskQuota(ALICE.instance, previousQuota)
  })

  test('refuses the file and shows the storage dialog', async ({
    alicePage,
    aliceDrive
  }) => {
    const folder = `Over quota ${stamp()}`
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: folder
    })
    const name = `over-quota-${stamp()}.txt`
    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    await aliceDrive.waitForEmptyState()

    // Ten times smaller than the file
    await setDiskQuota(ALICE.instance, 1_000)
    await aliceDrive.uploadFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('x'.repeat(10_000))
    })

    await expect(new QuotaPaywallPage(alicePage).dialog).toBeVisible()
    const uploaded = await fetchFileMetadataByPath({
      instance: ALICE.instance,
      path: `/${folder}/${name}`
    })
    expect(uploaded.status).toBe(404)
  })
})
