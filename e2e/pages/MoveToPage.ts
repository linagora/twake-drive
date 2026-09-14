import type { Locator, Page, Route } from '@playwright/test'

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
  private readonly moveRequestCounts = new Map<string, number>()
  private readonly moveFailures = new Map<string, number>()
  private routeHandler: ((route: Route) => Promise<void>) | null = null

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

  get dialogLocator(): Locator {
    return this.dialog
  }

  get creationForm(): Locator {
    return this.dialog.getByTestId('folder-picker-add-folder-item')
  }

  private async ensureNetworkInterceptor(): Promise<void> {
    if (this.routeHandler) return

    this.routeHandler = async (route): Promise<void> => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname
      const fileId = pathname.match(/\/files\/([^/]+)\/?$/)?.[1]

      if (!fileId) {
        await route.continue()
        return
      }

      if (request.method() === 'PATCH') {
        this.moveRequestCounts.set(
          fileId,
          (this.moveRequestCounts.get(fileId) ?? 0) + 1
        )
        const remainingFailures = this.moveFailures.get(fileId) ?? 0
        if (remainingFailures > 0) {
          this.moveFailures.set(fileId, remainingFailures - 1)
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Injected move failure' })
          })
          return
        }
      }

      await route.continue()
    }

    await this.page.route('**/files/**', this.routeHandler)
  }

  async failMoves(fileIds: string[], once = false): Promise<void> {
    await this.ensureNetworkInterceptor()
    for (const fileId of fileIds) {
      this.moveFailures.set(fileId, once ? 1 : Number.POSITIVE_INFINITY)
      this.moveRequestCounts.set(fileId, 0)
    }
  }

  moveRequestCount(fileId: string): number {
    return this.moveRequestCounts.get(fileId) ?? 0
  }

  async clearNetworkFailures(): Promise<void> {
    if (this.routeHandler) {
      await this.page.unroute('**/files/**', this.routeHandler)
      this.routeHandler = null
    }
    this.moveFailures.clear()
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
