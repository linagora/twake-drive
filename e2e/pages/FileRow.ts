import type { Page, Locator } from '@playwright/test'

import { MoveToPage } from './MoveToPage'
import { ShareModalPage } from './ShareModalPage'
import { escapeRegExp, expect } from '../helpers/fixtures'

interface ConfirmDialog {
  button: RegExp
  /** `required`: the dialog always shows up. `optional`: only confirm when
   * a dialog appears within a short grace window (some actions skip the
   * dialog when there's nothing to warn about). */
  wait: 'required' | 'optional'
}

const OPTIONAL_DIALOG_TIMEOUT = 2_000
const DOUBLE_CLICK_DELAY = 400

/**
 * Handle for a single row in the Drive file list. Returned from
 * `DrivePage.row(name)` so per-name action methods need only the values
 * specific to the action — the row already knows which file it is.
 *
 * Note: every menuitem regex below assumes the UI is in English.
 */
export class FileRow {
  private readonly anchored: RegExp

  constructor(
    private readonly page: Page,
    private readonly fileList: Locator,
    private readonly name: string
  ) {
    this.anchored = new RegExp(`^${escapeRegExp(name)}$`)
  }

  /** Locator for the row's filename cell — exposed so tests can assert
   * visibility / count without going through a wrapper method. Anchored
   * so similar names ("Folder 1" vs "Folder 12") don't collide.
   *
   * The legacy list exposes a dedicated test id while the virtualized table
   * exposes the untruncated name through the title attribute. Keep both
   * locators here so the page object supports either list implementation. */
  get cell(): Locator {
    return this.fileList
      .getByTestId('fil-file-filename-and-ext')
      .filter({ hasText: this.anchored })
      .or(this.fileList.getByTitle(this.name, { exact: true }))
  }

  private get rowEl(): Locator {
    // Both list implementations render semantic table rows. Locating the
    // nearest row also works when the virtualized filename is a span rather
    // than the legacy filename cell.
    return this.cell.locator('xpath=ancestor::tr[1]')
  }

  private get actionButton(): Locator {
    // The virtualized action component currently spells aria-label as
    // `arial-label`, so support it alongside the correctly labelled legacy
    // action button.
    return this.rowEl
      .getByRole('button', { name: 'More' })
      .or(this.rowEl.locator('button[arial-label="More"]'))
  }

  async waitVisible(opts?: { timeout?: number }): Promise<void> {
    let startedFromCurrentPosition = false
    await expect
      .poll(
        async (): Promise<number> => {
          const cell = this.cell.first()
          if ((await cell.count()) === 0) {
            if (startedFromCurrentPosition) await this.scrollNextViewport()
            else {
              await this.scrollFileListToTop()
              startedFromCurrentPosition = true
            }
            return 0
          }

          // Virtualized rows can be replaced between count() and the action
          // below while a query result is settling. Keep the whole lookup in
          // the poll so a detached row is retried instead of escaping as a
          // flaky Playwright error.
          try {
            await cell.scrollIntoViewIfNeeded()
            return (await cell.isVisible()) ? 1 : 0
          } catch {
            return 0
          }
        },
        { intervals: [50], timeout: opts?.timeout ?? 10_000 }
      )
      .toBe(1)
  }

  private async scrollFileListToTop(): Promise<void> {
    const scroller = this.fileList.locator(
      'xpath=ancestor::*[@data-testid="virtuoso-scroller"][1]'
    )
    if ((await scroller.count()) === 0) return
    await scroller.evaluate((element: HTMLElement) => {
      element.scrollTop = 0
    })
  }

  private async scrollNextViewport(): Promise<void> {
    const scroller = this.fileList.locator(
      'xpath=ancestor::*[@data-testid="virtuoso-scroller"][1]'
    )
    if ((await scroller.count()) === 0) return
    await scroller.evaluate((element: HTMLElement) => {
      element.scrollTop += Math.max(1, Math.floor(element.clientHeight / 2))
    })
  }

  async waitHidden(opts?: { timeout?: number }): Promise<void> {
    await this.cell.waitFor({ state: 'hidden', timeout: opts?.timeout })
  }

  async fileId(): Promise<string> {
    const href = await this.rowEl.getByRole('link').first().getAttribute('href')
    const fileId = href?.match(/\/file\/([^/?#]+)/)?.[1]
    if (!fileId) throw new Error(`No file id found for ${this.name}`)
    return fileId
  }

  async select(): Promise<void> {
    await this.waitVisible()
    await this.rowEl
      .getByRole('link')
      .first()
      .click({ modifiers: ['Control'] })
  }

  /** cozy-drive desktop semantics: single-click selects, double-click
   * navigates / opens. See src/hooks/useOnLongPress/helpers.js handleClick. */
  async open(): Promise<void> {
    // Virtualized rows outside the viewport are not mounted, so make the
    // row available before looking for its link.
    await this.waitVisible()
    // Two simple clicks trigger the app's double-click handling without
    // dispatching a native dblclick after navigation onto the next view.
    const link = this.rowEl.getByRole('link').first()
    // Virtuoso can reuse a row whose last click just opened its parent.
    await this.page.waitForTimeout(DOUBLE_CLICK_DELAY)
    await link.click()
    await link.click()
  }

  async openMenu(): Promise<Locator> {
    await this.actionButton.click()
    return this.page.getByRole('menu')
  }

  private async runAction(
    menuItem: RegExp,
    confirm?: ConfirmDialog
  ): Promise<void> {
    const menu = await this.openMenu()
    await menu.getByRole('menuitem', { name: menuItem }).click()
    if (!confirm) return

    const dialog = this.page.getByRole('dialog')
    if (confirm.wait === 'required') {
      await dialog.waitFor({ state: 'visible' })
    } else {
      // Brief grace period for the dialog to appear; if it doesn't, the
      // action skipped the confirm and we're already done. Only swallow
      // the timeout — anything else (page detached, closed context,
      // strict-mode violation) should propagate.
      const appeared = await dialog
        .waitFor({ state: 'visible', timeout: OPTIONAL_DIALOG_TIMEOUT })
        .then(() => true)
        .catch((err: Error) => {
          if (err.name === 'TimeoutError') return false
          throw err
        })
      if (!appeared) return
    }
    await dialog.getByRole('button', { name: confirm.button }).click()
    await dialog.waitFor({ state: 'hidden' })
  }

  async rename(newName: string): Promise<void> {
    const menu = await this.openMenu()
    await menu.getByRole('menuitem', { name: /^rename$/i }).click()
    const input = this.page.getByTestId('name-input').locator('input')
    await input.waitFor({ state: 'visible' })
    await input.fill(newName)
    await input.press('Enter')
    await this.fileList
      .getByTitle(newName, { exact: true })
      .or(
        this.fileList
          .getByTestId('fil-file-filename-and-ext')
          .filter({ hasText: new RegExp(`^${escapeRegExp(newName)}$`) })
      )
      .waitFor({ state: 'visible' })
  }

  async openMoveTo(): Promise<MoveToPage> {
    const menu = await this.openMenu()
    await menu.getByRole('menuitem', { name: /move to/i }).click()
    const moveTo = new MoveToPage(this.page)
    await moveTo.waitForOpen()
    return moveTo
  }

  async moveTo(targetFolder: string): Promise<void> {
    const moveTo = await this.openMoveTo()
    await moveTo.openFolder(targetFolder)
    await moveTo.confirm()
  }

  async duplicate(): Promise<void> {
    await this.runAction(/duplicate/i, {
      button: /duplicate|confirm|ok/i,
      wait: 'optional'
    })
  }

  async sendToTrash(): Promise<void> {
    await this.runAction(/^remove$/i, {
      button: /^remove$/i,
      wait: 'required'
    })
    await this.waitHidden()
  }

  async addToFavorites(): Promise<void> {
    await this.runAction(/add to favorites/i)
  }

  /** Open the row's action menu and click "Share", then return a ready-to-use
   *  ShareModalPage. Use this when the toolbar's Share button is unavailable
   *  (e.g. when acting on a file, which has no folder-scoped toolbar). */
  async share(): Promise<ShareModalPage> {
    const menu = await this.openMenu()
    await menu.getByRole('menuitem', { name: /^share$/i }).click()
    const modal = new ShareModalPage(this.page)
    await modal.waitForOpen()
    return modal
  }

  async restore(): Promise<void> {
    await this.runAction(/^restore$/i)
    await this.waitHidden()
  }
}
