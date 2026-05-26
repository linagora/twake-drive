import type { Page, Locator } from '@playwright/test'

import { FileRow } from './FileRow'

/**
 * Page object for the Drive file list view (My Drive, Trash, Favorites,
 * inside a folder or shared drive — anything that renders the standard
 * fil-content-body table). Per-row actions live on `FileRow` so callers
 * write `drive.row('foo').rename('bar')` instead of passing names through
 * many separate methods.
 */
export class DrivePage {
  private readonly page: Page
  private readonly fileList: Locator

  constructor(page: Page) {
    this.page = page
    this.fileList = page.getByTestId('fil-content-body')
  }

  row(name: string): FileRow {
    return new FileRow(this.page, this.fileList, name)
  }

  /** Locator for the file list cell whose filename contains the substring —
   *  use for "the original and its (1) copy" style multi-row assertions. */
  matching(stem: string): Locator {
    return this.fileList
      .getByTestId('fil-file-filename-and-ext')
      .filter({ hasText: stem })
  }

  async createFolder(name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Create' }).click()
    await this.page.getByTestId('add-folder-link').click()
    const input = this.page.getByTestId('name-input').locator('input')
    await input.waitFor({ state: 'visible' })
    await input.fill(name)
    await input.press('Enter')
    await this.row(name).waitVisible()
  }

  /** cozy-ui's FileInput spreads extra props onto the underlying <input
   * type=file>, so the `upload-btn` testid lives on the input itself. */
  async uploadFiles(filePaths: string | string[]): Promise<void> {
    await this.page
      .locator('input[data-testid="upload-btn"]')
      .first()
      .setInputFiles(filePaths)
  }
}
