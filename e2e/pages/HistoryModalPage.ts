import type { Download, Locator, Page } from '@playwright/test'

import { t } from '../helpers/i18n'

/** The history (versions) modal of a file. */
export class HistoryModalPage {
  readonly page: Page
  /** The modal dialog, titled with the name of the file. */
  readonly dialog: Locator
  /** One per row: the current version first, then the older versions,
   * newest first. */
  readonly downloadButtons: Locator
  /** One per older version, offered only with write access. */
  readonly deleteButtons: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.getByRole('dialog')
    this.downloadButtons = this.dialog.getByTestId('history-row-download')
    this.deleteButtons = this.dialog.getByTestId('history-row-delete')
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
  }

  async close(): Promise<void> {
    await this.dialog.getByTestId(/^modal-close-button-/).click()
    await this.dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  }

  /** Download an older version, 0 being the newest one. */
  async downloadVersion(index: number): Promise<Download> {
    const download = this.page.waitForEvent('download')
    await this.downloadButtons.nth(index + 1).click()
    return await download
  }

  /** Delete an older version, 0 being the newest one, and confirm it. */
  async deleteVersion(index: number): Promise<void> {
    await this.deleteButtons.nth(index).click()
    // `exact` matters: the delete buttons of the rows are labelled "Delete
    // this version", which a substring match would pick up as well.
    await this.page
      .getByRole('button', {
        name: t('History.deleteVersion.confirm'),
        exact: true
      })
      .click()
  }
}
