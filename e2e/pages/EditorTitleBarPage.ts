import type { Page, Locator } from '@playwright/test'

import { expect, escapeRegExp } from '../helpers/fixtures'

/** Title bar of the full-screen editors (Excalidraw, PDF, OnlyOffice). */
export class EditorTitleBarPage {
  private readonly bar: Locator

  constructor(page: Page) {
    this.bar = page.getByTestId(/^(excalidraw|pdf|onlyoffice)-title$/)
  }

  async waitForOpen(): Promise<void> {
    await this.bar.waitFor({ state: 'visible', timeout: 20_000 })
  }

  /** Retries: on the public page the link waits for the member's instance. */
  async expectHomeLinkTo(instance: string): Promise<void> {
    await expect(this.bar.getByTestId('editor-home-link')).toHaveAttribute(
      'href',
      new RegExp(escapeRegExp(instance)),
      { timeout: 10_000 }
    )
  }

  async expectBackButton(): Promise<void> {
    await expect(this.bar.getByTestId('onlyoffice-backButton')).toBeVisible()
  }

  async share(): Promise<void> {
    await this.bar.getByRole('button', { name: /^share$/i }).click()
  }
}
