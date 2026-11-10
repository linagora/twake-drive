import type { Locator, Page } from '@playwright/test'

import { escapeRegExp, expect, expectRowDisabled } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

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
    return this.dialog.getByRole('tab', {
      name: t('Nav.item_drive')
    })
  }

  get sharingsTab(): Locator {
    return this.dialog.getByRole('tab', {
      name: t('Nav.item_sharings')
    })
  }

  get createFolderButton(): Locator {
    return this.dialog.getByRole('button', {
      name: t('Move.addFolder')
    })
  }

  get cancelButton(): Locator {
    return this.dialog.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(t('Move.cancel'))}$`, 'i')
    })
  }

  get moveButton(): Locator {
    return this.dialog.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(t('Move.action'))}$`, 'i')
    })
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
    return this.dialog.getByRole('textbox', {
      name: t('Move.folderName')
    })
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
    await expect(this.breadcrumb).toHaveText(t('Nav.item_sharings'))
  }

  async folderRow(name: string): Promise<Locator> {
    const splitAt = Math.ceil(name.length / 2)
    const prefix = name.slice(0, splitAt)
    const suffix = name.slice(splitAt)
    const row: Locator = this.dialog.getByRole('row', {
      name: new RegExp(`^${escapeRegExp(prefix)}.*${escapeRegExp(suffix)}`)
    })
    const scroller: Locator = this.dialog.getByTestId('virtuoso-scroller')

    // Virtualized rows must be mounted before Playwright can scroll to them.
    await expect
      .poll(
        async (): Promise<number> => {
          const count: number = await row.count()
          if (count === 0) {
            await scroller.evaluate((element: HTMLElement) => {
              const maxScrollTop: number =
                element.scrollHeight - element.clientHeight
              element.scrollTop =
                element.scrollTop >= maxScrollTop
                  ? 0
                  : Math.min(
                      element.scrollTop + element.clientHeight,
                      maxScrollTop
                    )
            })
          }
          return count
        },
        { intervals: [50], timeout: 5_000 }
      )
      .toBeGreaterThan(0)

    await row.scrollIntoViewIfNeeded()
    return row
  }

  row(name: string): Locator {
    return this.dialog
      .getByTestId('list-item')
      .filter({ has: this.page.getByTitle(name, { exact: true }) })
  }

  async expectRowDisabled(name: string): Promise<void> {
    await expectRowDisabled(this.row(name))
  }

  async folderId(name: string): Promise<string> {
    const row: Locator = await this.folderRow(name)
    const folderId = await row.getAttribute('data-file-id')
    if (!folderId) throw new Error(`No folder id found for ${name}`)
    return folderId
  }

  async selectFolder(name: string): Promise<void> {
    const row: Locator = await this.folderRow(name)
    await row.click()
    await expect(this.moveButton).toBeEnabled()
  }

  async openFolder(name: string): Promise<void> {
    const row: Locator = await this.folderRow(name)
    await row.dblclick()
    await expect(
      this.dialog.getByTestId('file-picker-breadcrumb')
    ).toContainText(name)
  }

  async showFolderCreation(): Promise<void> {
    await this.createFolderButton.click()
    await expect(this.creationInput).toBeVisible()
  }

  async expectFolderDisabled(name: string, reason: RegExp): Promise<void> {
    const row: Locator = await this.folderRow(name)
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
        escapeRegExp(
          t('Move.outsideSharedFolder.title', {
            sharedFolder: sharedFolderName
          })
        )
      )
    })
    await expect(confirmDialog).toBeVisible()
    await confirmDialog
      .getByRole('button', { name: t('Move.outsideSharedFolder.confirm') })
      .click()
  }

  async expectPartialResult(
    successfulCount: number,
    failedCount: number
  ): Promise<void> {
    await expect(
      this.page.getByText(
        t('Move.partialError', {
          successCount: successfulCount,
          failureCount: failedCount
        })
      )
    ).toBeVisible()
  }

  async expectTotalFailure(): Promise<void> {
    await expect(this.dialog).toBeVisible()
    await expect(
      this.page.getByText(t('Move.error', { smart_count: 2 }))
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
      this.dialog.getByRole('button', {
        name: t('Viewer.loading.retry')
      })
    ).toHaveCount(0)
  }

  async expectSuccessNotification(
    name: string,
    destination: string
  ): Promise<void> {
    await expect(
      this.page.getByRole('alert').filter({
        hasText: t('Move.success', {
          smart_count: 1,
          subject: name,
          target: destination
        })
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
      has: this.page.getByText(
        new RegExp(`^${escapeRegExp(t('Move.insideSharedFolder.title'))}$`, 'i')
      )
    })
    await expect(confirmation).toBeVisible()
    await confirmation
      .getByRole('button', {
        name: new RegExp(
          `^${escapeRegExp(t('Move.insideSharedFolder.confirm'))}$`,
          'i'
        )
      })
      .click()
    await expect(confirmation).toBeHidden()
    await expect(this.dialog).toBeHidden()
  }

  async close(): Promise<void> {
    await this.cancelButton.click()
    await expect(this.dialog).toBeHidden()
  }

  async isFolderSelected(name: string): Promise<boolean> {
    const row: Locator = await this.folderRow(name)
    return row.evaluate(row => row.classList.contains('Mui-selected'))
  }

  get breadcrumb(): Locator {
    return this.dialog.getByTestId('file-picker-breadcrumb')
  }
}
