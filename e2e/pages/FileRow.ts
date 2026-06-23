import type { Page, Locator } from '@playwright/test'

import { ShareModalPage } from './ShareModalPage'
import { escapeRegExp } from '../helpers/fixtures'

interface ConfirmDialog {
  button: RegExp
  /** `required`: the dialog always shows up. `optional`: only confirm when
   * a dialog appears within a short grace window (some actions skip the
   * dialog when there's nothing to warn about). */
  wait: 'required' | 'optional'
}

const OPTIONAL_DIALOG_TIMEOUT = 2_000

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
   * so similar names ("Folder 1" vs "Folder 12") don't collide. */
  get cell(): Locator {
    return this.fileList
      .getByTestId('fil-file-filename-and-ext')
      .filter({ hasText: this.anchored })
  }

  private get rowEl(): Locator {
    // Each row is a plain <div> with no semantic role; locate the closest
    // ancestor that contains the per-row "More" button — that's the row.
    return this.cell.locator(
      'xpath=ancestor::*[.//button[@aria-label="More"]][1]'
    )
  }

  async waitVisible(opts?: { timeout?: number }): Promise<void> {
    await this.cell.waitFor({ state: 'visible', timeout: opts?.timeout })
  }

  async waitHidden(opts?: { timeout?: number }): Promise<void> {
    await this.cell.waitFor({ state: 'hidden', timeout: opts?.timeout })
  }

  /** cozy-drive desktop semantics: single-click selects, double-click
   * navigates / opens. See src/hooks/useOnLongPress/helpers.js handleClick. */
  async open(): Promise<void> {
    // The row's link includes the value of every column in its accessible
    // name ("Foo — — —"), so we locate the row through the filename cell
    // and dblclick whichever link sits inside.
    await this.rowEl.getByRole('link').first().dblclick()
  }

  async openMenu(): Promise<Locator> {
    await this.rowEl.getByRole('button', { name: 'More' }).click()
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
      .getByTestId('fil-file-filename-and-ext')
      .filter({ hasText: new RegExp(`^${escapeRegExp(newName)}$`) })
      .waitFor({ state: 'visible' })
  }

  async moveTo(targetFolder: string): Promise<void> {
    const menu = await this.openMenu()
    await menu.getByRole('menuitem', { name: /move to/i }).click()
    const dialog = this.page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible' })
    // No .first() here — if the folder name is ambiguous in the picker,
    // surface that as a Playwright strict-mode error instead of silently
    // operating on whichever match the DOM happened to put first.
    await dialog
      .getByRole('button', {
        name: new RegExp(`^${escapeRegExp(targetFolder)}$`)
      })
      .dblclick()
    await dialog.getByRole('button', { name: /^move$/i }).click()
    await dialog.waitFor({ state: 'hidden' })
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
