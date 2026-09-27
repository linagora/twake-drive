import type { Page } from '@playwright/test'

import { expect } from '../helpers/fixtures'
import type { FileRow } from './FileRow'

export class OnlyOfficePage {
  constructor(private readonly page: Page) {}

  async openFromRow(row: FileRow, fileId: string): Promise<void> {
    const configResponse = this.page.waitForResponse(
      response => response.url().includes(`/office/${fileId}/open`),
      { timeout: 60_000 }
    )

    await row.open()
    await expect(this.page).toHaveURL(new RegExp(`/onlyoffice/${fileId}`))

    const response = await configResponse
    expect(response.ok()).toBe(true)
    const body = await response.json()
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
