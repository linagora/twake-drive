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

  /** Right-click the empty file-list area to open RightClickAddMenu (menu id
   * `AddMenu`). Both the toolbar and the context menu render the same
   * `add-folder-link` testid, so the click is scoped to the open menu. */
  async createFolderViaContextMenu(name: string): Promise<void> {
    await this.openAddContextMenu()
    await this.page
      .getByRole('menu')
      .locator('[data-testid="add-folder-link"]')
      .click()
    const input = this.page.getByTestId('name-input').locator('input')
    await input.waitFor({ state: 'visible' })
    await input.fill(name)
    await input.press('Enter')
    await this.row(name).waitVisible()
  }

  /** Same context menu as createFolderViaContextMenu, driving the upload
   * input the menu renders. setInputFiles works on the hidden input, so this
   * asserts the menu path opens and feeds the same upload pipeline. */
  async uploadFilesViaContextMenu(filePaths: string | string[]): Promise<void> {
    await this.openAddContextMenu()
    await this.page
      .getByRole('menu')
      .locator('input[data-testid="upload-btn"]')
      .setInputFiles(filePaths)
  }

  /** Synthesise an OS drag-and-drop: Playwright can't drag real files, so we
   * build a DataTransfer in-page and dispatch the drop on the file list, which
   * bubbles to the react-dropzone root wrapping it.
   *
   * react-dropzone's file-selector defaults a dropped file's path to
   * `./<name>` when `webkitGetAsEntry` is null (always, for a scripted
   * DataTransfer). Drive reads that `./` as a folder structure and tries to
   * create a "." folder, which fails. Pinning `webkitRelativePath` to the bare
   * name yields a slash-free path so Drive treats it as a loose top-level file. */
  async dropFiles(
    files: { name: string; mime: string; content: string }[]
  ): Promise<void> {
    const dataTransfer = await this.page.evaluateHandle(items => {
      const dt = new DataTransfer()
      for (const item of items) {
        const file = new File([item.content], item.name, { type: item.mime })
        Object.defineProperty(file, 'webkitRelativePath', {
          value: item.name,
          configurable: true
        })
        dt.items.add(file)
      }
      return dt
    }, files)

    await this.fileList.dispatchEvent('drop', { dataTransfer })
  }

  /** Right-click the empty content area; the dropzone wrapper's onContextMenu
   * opens the AddMenu. Callers must be in an empty folder so the click lands
   * on blank space and not on a file row (which opens the file menu instead). */
  private async openAddContextMenu(): Promise<void> {
    await this.fileList.click({ button: 'right' })
    await this.page.getByRole('menu').waitFor({ state: 'visible' })
  }
}
