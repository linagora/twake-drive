import type { Page } from '@playwright/test'

import type { FileRow } from './FileRow'
import { escapeRegExp, expect } from '../helpers/fixtures'

export class OnlyOfficePage {
  constructor(private readonly page: Page) {}

  async openFromRow(row: FileRow, fileId: string): Promise<void> {
    const configResponse = this.page.waitForResponse(
      response => response.url().includes(`/office/${fileId}/open`),
      { timeout: 60_000 }
    )

    await row.open()
    await expect(this.page).toHaveURL(
      new RegExp(`/onlyoffice/${escapeRegExp(fileId)}`)
    )

    const response = await configResponse
    expect(response.ok()).toBe(true)
    const body = (await response.json()) as {
      data: { attributes: { onlyoffice: { documentType: string } } }
    }
    expect(body.data.attributes.onlyoffice.documentType).toBe('word')

    await expect(this.page.getByTestId('onlyoffice-title')).toBeVisible()
    await expect(this.page.locator('iframe[name="frameEditor"]')).toBeVisible({
      timeout: 90_000
    })
    await expect(
      this.page
        .frameLocator('iframe[name="frameEditor"]')
        .getByText('Page 1 of 1')
    ).toBeVisible({ timeout: 90_000 })
  }
}
