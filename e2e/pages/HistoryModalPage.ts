import type { Locator, Page } from '@playwright/test'

/** The history (versions) modal of a file. */
export class HistoryModalPage {
  /** The modal dialog, titled with the name of the file. */
  readonly dialog: Locator

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog')
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
  }

  async close(): Promise<void> {
    await this.dialog.getByTestId(/^modal-close-button-/).click()
    await this.dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  }
}
