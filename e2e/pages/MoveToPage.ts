import type { Locator, Page } from '@playwright/test'

import { escapeRegExp, expect } from '../helpers/fixtures'

/**
 * Page object for the MoveTo destination picker.
 *
 * The picker is rendered in the Move dialog on the parent Drive page, unlike
 * the intent FilePicker which is rendered in an iframe. Keeping these locators
 * here lets E2E specs describe user behavior without coupling themselves to
 * the table implementation.
 */
export class MoveToPage {
  private readonly dialog: Locator

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog')
  }

  get createFolderButton(): Locator {
    return this.dialog.getByRole('button', { name: /create folder/i })
  }

  get cancelButton(): Locator {
    return this.dialog.getByRole('button', { name: /^cancel$/i })
  }

  get moveButton(): Locator {
    return this.dialog.getByRole('button', { name: /^move$/i })
  }

  get creationForm(): Locator {
    return this.dialog.getByTestId('folder-picker-add-folder-item')
  }

  get creationInput(): Locator {
    return this.dialog.getByRole('textbox', { name: /folder name/i })
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
    await this.dialog.getByTestId('move-to-browser').waitFor({
      state: 'visible'
    })
  }

  folderRow(name: string): Locator {
    const splitAt = Math.ceil(name.length / 2)
    const prefix = name.slice(0, splitAt)
    const suffix = name.slice(splitAt)
    return this.dialog.getByRole('row', {
      name: new RegExp(`^${escapeRegExp(prefix)}.*${escapeRegExp(suffix)}`)
    })
  }

  async openFolder(name: string): Promise<void> {
    await this.folderRow(name).dblclick()
    await expect(
      this.dialog.getByTestId('file-picker-breadcrumb')
    ).toContainText(name)
  }

  async showFolderCreation(): Promise<void> {
    await this.createFolderButton.click()
    await expect(this.creationInput).toBeVisible()
  }

  async expectFolderDisabled(name: string, reason: RegExp): Promise<void> {
    const row = this.folderRow(name)
    await expect(row).toHaveAttribute('aria-disabled', 'true')
    await expect(row).toHaveAccessibleName(reason)
    await row.getByTestId('picker-item-name').hover()
    await expect(this.page.getByRole('tooltip')).toHaveText(reason)
  }

  async expectMoveDisabled(): Promise<void> {
    await expect(this.moveButton).toBeDisabled()
  }

  async confirm(): Promise<void> {
    await this.moveButton.click()
    await expect(this.dialog).toBeHidden()
  }

  async close(): Promise<void> {
    await this.cancelButton.click()
    await expect(this.dialog).toBeHidden()
  }

  async isFolderSelected(name: string): Promise<boolean> {
    return this.folderRow(name).evaluate(row =>
      row.classList.contains('Mui-selected')
    )
  }

  get breadcrumb(): Locator {
    return this.dialog.getByTestId('file-picker-breadcrumb')
  }
}
