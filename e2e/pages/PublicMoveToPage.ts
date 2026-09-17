import type { Locator, Page } from '@playwright/test'

import { escapeRegExp, expect } from '../helpers/fixtures'

export class PublicMoveToPage {
  private readonly dialog: Locator

  constructor(page: Page) {
    this.dialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: /^move$/i }) })
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
  }

  async openFolder(name: string): Promise<void> {
    await this.dialog
      .getByRole('button', {
        name: new RegExp(`^${escapeRegExp(name)}`)
      })
      .click()
    await expect(
      this.dialog.getByRole('heading', { name, exact: true })
    ).toBeVisible()
  }

  async confirm(): Promise<void> {
    await this.dialog.getByRole('button', { name: /^move$/i }).click()
    await expect(this.dialog).toBeHidden()
  }
}
