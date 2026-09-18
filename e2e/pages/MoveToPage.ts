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
function getFileId(url: URL): string | null {
  return url.pathname.match(/\/files\/([^/]+)\/?$/)?.[1] ?? null
}

export class MoveToPage {
  private readonly dialog: Locator
  private readonly moveRequestCounts = new Map<string, number>()

  constructor(private readonly page: Page) {
    this.dialog = page
      .getByRole('dialog')
      .filter({ has: page.getByTestId('move-to-browser') })
    page.on('request', request => {
      const fileId = getFileId(new URL(request.url()))
      if (request.method() !== 'PATCH' || !fileId) return
      this.moveRequestCounts.set(
        fileId,
        (this.moveRequestCounts.get(fileId) ?? 0) + 1
      )
    })
  }

  get driveTab(): Locator {
    return this.dialog.getByRole('tab', { name: /my drive/i })
  }

  get sharingsTab(): Locator {
    return this.dialog.getByRole('tab', { name: /sharings/i })
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

  get dialogLocator(): Locator {
    return this.dialog
  }

  get creationForm(): Locator {
    return this.dialog.getByTestId('folder-picker-add-folder-item')
  }

  async failNextMove(fileId: string): Promise<void> {
    await this.page.route(
      url => getFileId(url) === fileId,
      async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Injected move failure' })
        })
      },
      { times: 1 }
    )
  }

  moveRequestCount(fileId: string): number {
    return this.moveRequestCounts.get(fileId) ?? 0
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

  async expectDestinationTabs(): Promise<void> {
    await expect(this.dialog.getByRole('tab')).toHaveCount(2)
    await expect(this.driveTab).toHaveAttribute('aria-selected', 'true')
    await expect(this.sharingsTab).toBeVisible()
  }

  async openSharings(): Promise<void> {
    await this.sharingsTab.click()
    await expect(this.sharingsTab).toHaveAttribute('aria-selected', 'true')
    await expect(this.breadcrumb).toHaveText('Sharings')
  }

  folderRow(name: string): Locator {
    const splitAt = Math.ceil(name.length / 2)
    const prefix = name.slice(0, splitAt)
    const suffix = name.slice(splitAt)
    return this.dialog.getByRole('row', {
      name: new RegExp(`^${escapeRegExp(prefix)}.*${escapeRegExp(suffix)}`)
    })
  }

  async folderId(name: string): Promise<string> {
    const folderId = await this.folderRow(name).getAttribute('data-file-id')
    if (!folderId) throw new Error(`No folder id found for ${name}`)
    return folderId
  }

  async selectFolder(name: string): Promise<void> {
    await this.folderRow(name).click()
    await expect(this.moveButton).toBeEnabled()
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

  async clickMove(): Promise<void> {
    await this.moveButton.click()
  }

  async confirmMovingOutsideSharedFolder(
    sharedFolderName: string
  ): Promise<void> {
    const confirmDialog = this.page.getByRole('dialog', {
      name: new RegExp(
        `Moving outside the ${escapeRegExp(sharedFolderName)} folder`
      )
    })
    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'I understand' }).click()
  }

  async expectPartialResult(
    successfulCount: number,
    failedCount: number
  ): Promise<void> {
    await expect(
      this.page.getByText(
        new RegExp(
          `(Moved: ${successfulCount}\\. Failed: ${failedCount}\\.|Déplacés : ${successfulCount}\\. Échecs : ${failedCount}\\.)`
        )
      )
    ).toBeVisible()
  }

  async expectTotalFailure(): Promise<void> {
    await expect(this.dialog).toBeVisible()
    await expect(
      this.page.getByText(
        /Something went wrong while moving these elements|Une erreur est survenue pendant le déplacement de ces éléments/i
      )
    ).toBeVisible()
    await expect(this.moveButton).toBeEnabled()
    await expect(this.cancelButton).toBeEnabled()
  }

  async expectRemainingEntry(name: string): Promise<void> {
    await expect(this.dialog.getByRole('heading')).toHaveText(name)
  }

  async expectDestinationLocked(): Promise<void> {
    const breadcrumbButtons = this.dialog
      .getByTestId('file-picker-breadcrumb')
      .getByRole('button')
    const count = await breadcrumbButtons.count()
    for (let index = 0; index < count; index += 1) {
      await expect(breadcrumbButtons.nth(index)).toBeDisabled()
    }
    await expect(this.createFolderButton).toBeDisabled()
    await expect(this.moveButton).toBeEnabled()
    await expect(this.cancelButton).toBeEnabled()
    await expect(
      this.dialog.getByRole('button', { name: /retry/i })
    ).toHaveCount(0)
  }

  async expectSuccessNotification(name: string): Promise<void> {
    await expect(
      this.page.getByRole('alert').filter({
        hasText: new RegExp(`${escapeRegExp(name)}.*moved`)
      })
    ).toBeVisible()
  }

  async confirm(): Promise<void> {
    await this.clickMove()
    await expect(this.dialog).toBeHidden()
  }

  async confirmSharedFolderMove(): Promise<void> {
    await this.clickMove()
    const confirmation = this.page.getByRole('dialog').filter({
      has: this.page.getByText(/^Move to a shared folder\?$/i)
    })
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole('button', { name: /^ok$/i }).click()
    await expect(confirmation).toBeHidden()
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
