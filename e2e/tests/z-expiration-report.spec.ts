import { readFile } from 'node:fs/promises'

import type { Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { setFlags } from '../helpers/flags'
import { createFile, createFolder, findLinkPermission } from '../helpers/stack'
import { ShareByLinkPage } from '../pages/ShareByLinkPage'
import { ShareModalPage } from '../pages/ShareModalPage'

const REPORT_FLAG = 'drive.public_link_events.enabled'
const ROOT = `${USERS.alice.appUrl}/#/folder`

async function formatExpirationDate(
  page: Page,
  timestamp: number
): Promise<string> {
  return page.evaluate(value => {
    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).format(value)
  }, timestamp)
}

async function openRestrictions(page: Page): Promise<ShareByLinkPage> {
  await new ShareModalPage(page).waitForOpen()
  const link = new ShareByLinkPage(page)
  await link.waitForLinkRow()
  await link.openRestrictions()
  return link
}

test.describe('Expiration activity report', () => {
  test.afterEach(() => {
    setFlags(USERS.alice.instance, { [REPORT_FLAG]: false })
  })

  for (const kind of ['folder', 'file']) {
    test(`creates and edits an expiration report for a ${kind}`, async ({
      alicePage,
      aliceDrive
    }) => {
      setFlags(USERS.alice.instance, { [REPORT_FLAG]: true })
      await alicePage
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write'])
      const name = `Report ${stamp()}${kind === 'file' ? '.txt' : ''}`
      const id =
        kind === 'folder'
          ? await createFolder({ instance: USERS.alice.instance, name })
          : await createFile({
              instance: USERS.alice.instance,
              name,
              content: 'report test'
            })
      const url = kind === 'folder' ? `${ROOT}/${id}` : ROOT
      await alicePage.goto(url)
      if (kind === 'folder') {
        await aliceDrive.openShareModal()
      } else {
        await aliceDrive.row(name).share()
      }
      let link = new ShareByLinkPage(alicePage)
      await link.openRestrictions()
      await expect(link.activityReportCheckbox).toBeVisible()
      await expect(link.downloadReportButton).toBeDisabled()
      await link.expirationCheckbox.uncheck()
      await expect(link.activityReportCheckbox).not.toBeChecked()
      await expect(link.activityReportCheckbox).toBeDisabled()
      const requestedExpiry = await alicePage.evaluate(() => {
        const date = new Date()
        date.setDate(date.getDate() + 7)
        return date.setHours(23, 59, 59, 999)
      })
      await link.enableExpiration(
        await formatExpirationDate(alicePage, requestedExpiry)
      )
      await expect(link.activityReportCheckbox).toBeEnabled()
      await link.activityReportCheckbox.check()
      await link.confirm()

      const permission = await findLinkPermission(USERS.alice.instance, id)
      const expiresAt = permission.attributes.expires_at
      const savedExpiry = Date.parse(expiresAt ?? '')
      expect(permission.attributes.activity_report_enabled).toBe(true)
      expect(savedExpiry).toBeGreaterThan(Date.now())
      // The relative TTL can round past midnight when Stack creates the link.
      expect(Math.abs(savedExpiry - requestedExpiry)).toBeLessThanOrEqual(
        60_000
      )
      const savedDate = await formatExpirationDate(alicePage, savedExpiry)

      await alicePage.reload()
      link = await openRestrictions(alicePage)
      await expect(link.activityReportCheckbox).toBeChecked()
      await expect(link.expirationInput).toHaveValue(savedDate)
      await expect(link.activityReportCheckbox).toBeEnabled()
      await expect(link.downloadReportButton).toBeEnabled()
      const [response, download] = await Promise.all([
        alicePage.waitForResponse(res =>
          new URL(res.url()).pathname.endsWith(
            `/permissions/${permission.id}/statistics`
          )
        ),
        link.downloadReport()
      ])
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('text/csv')
      expect(download.suggestedFilename()).toBe('public-link-statistics.csv')
      const csv = await readFile(await download.path(), 'utf8')
      expect(csv.split(/\r?\n/)[0]).toBe('occurred_at,IP,identity,action')
      await link.activityReportCheckbox.uncheck()
      await link.confirm()

      const updated = await findLinkPermission(USERS.alice.instance, id)
      expect(updated.id).toBe(permission.id)
      expect(updated.attributes.activity_report_enabled).toBe(false)
      expect(updated.attributes.expires_at).toBe(expiresAt)

      await alicePage.reload()
      link = await openRestrictions(alicePage)
      await expect(link.activityReportCheckbox).toBeEnabled()
      await expect(link.activityReportCheckbox).not.toBeChecked()
      await expect(link.expirationInput).toHaveValue(savedDate)
    })
  }

  test('hides the option after disabling statistics and reloading', async ({
    alicePage,
    aliceDrive
  }) => {
    setFlags(USERS.alice.instance, { [REPORT_FLAG]: true })
    const id = await createFolder({
      instance: USERS.alice.instance,
      name: `Flag report ${stamp()}`
    })
    await alicePage.goto(`${ROOT}/${id}`)
    await aliceDrive.openShareModal()
    const link = new ShareByLinkPage(alicePage)
    await link.openRestrictions()
    await expect(link.activityReportCheckbox).toBeVisible()
    await expect(link.downloadReportButton).toBeVisible()
    setFlags(USERS.alice.instance, { [REPORT_FLAG]: false })
    await alicePage.reload()
    await new ShareModalPage(alicePage).waitForOpen()
    await link.openRestrictions()
    await expect(link.activityReportCheckbox).toHaveCount(0)
    await expect(link.downloadReportButton).toHaveCount(0)
  })
})
