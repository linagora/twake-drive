import type { Download, Page, Locator } from '@playwright/test'

import { MoveToPage } from './MoveToPage'
import { ShareModalPage } from './ShareModalPage'
import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

interface ConfirmDialog {
  button: RegExp
  /** `required`: the dialog always shows up. `optional`: only confirm when
   * a dialog appears within a short grace window (some actions skip the
   * dialog when there's nothing to warn about). */
  wait: 'required' | 'optional'
  /** Text the dialog must show before it is confirmed. */
  title?: string
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
      `xpath=ancestor::*[.//button[@aria-label="${t('Toolbar.more')}"]][1]`
    )
  }

  async waitVisible(opts?: { timeout?: number }): Promise<void> {
    await this.cell.waitFor({ state: 'visible', timeout: opts?.timeout })
  }

  async waitHidden(opts?: { timeout?: number }): Promise<void> {
    await this.cell.waitFor({ state: 'hidden', timeout: opts?.timeout })
  }

  async isNewSharingShortcut(): Promise<boolean> {
    return this.rowEl
      .getByLabel(t('table.row_sharing_shortcut_aria_label'))
      .isVisible()
  }

  async fileId(): Promise<string> {
    const href = await this.rowEl.getByRole('link').first().getAttribute('href')
    const fileId = href?.match(
      /\/(?:file|onlyoffice)\/(?:[^/?#]+\/)?([^/?#]+)/
    )?.[1]
    if (!fileId) throw new Error(`No file id found for ${this.name}`)
    return fileId
  }

  async select(): Promise<void> {
    await this.rowEl.getByRole('checkbox').click()
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
    await this.rowEl.getByRole('button', { name: t('Toolbar.more') }).click()
    return this.page.getByRole('menu')
  }

  async openContextMenu(): Promise<Locator> {
    await this.cell.click({ button: 'right' })
    const menu = this.page.getByRole('menu')
    await menu.waitFor({ state: 'visible' })
    return menu
  }

  /** Right-clicks the row and sends it to the Bin from that menu. Returns
   * the entries the menu offered. */
  async sendToTrashFromContextMenu(): Promise<string[]> {
    let items: string[] = []
    await this.sendToTrash(async () => {
      const menu = await this.openContextMenu()
      items = (await menu.getByRole('menuitem').allInnerTexts()).map(item =>
        item.trim()
      )
      return menu
    })
    return items
  }

  private async runAction(
    menuItem: RegExp,
    confirm?: ConfirmDialog,
    open: () => Promise<Locator> = () => this.openMenu()
  ): Promise<void> {
    const menu = await open()
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
    if (confirm.title) await expect(dialog).toContainText(confirm.title)
    await dialog.getByRole('button', { name: confirm.button }).click()
    await dialog.waitFor({ state: 'hidden' })
  }

  async rename(newName: string): Promise<void> {
    const menu = await this.openMenu()
    await menu
      .getByRole('menuitem', {
        name: new RegExp(`^${escapeRegExp(t('SelectionBar.rename'))}$`, 'i')
      })
      .click()
    const input = this.page.getByTestId('name-input').locator('input')
    await input.waitFor({ state: 'visible' })
    await input.fill(newName)
    await input.press('Enter')
    await this.fileList
      .getByTestId('fil-file-filename-and-ext')
      .filter({ hasText: new RegExp(`^${escapeRegExp(newName)}$`) })
      .waitFor({ state: 'visible' })
  }

  async openMoveTo(): Promise<MoveToPage> {
    const menu = await this.openMenu()
    const menuItem = menu.getByRole('menuitem', {
      name: t('SelectionBar.moveto')
    })
    if (await menuItem.isVisible()) {
      await menuItem.click()
    } else {
      // On a phone the action sheet lists buttons, labelled for mobile
      await this.page
        .getByRole('button', {
          name: new RegExp(
            `^${escapeRegExp(t('SelectionBar.moveto_mobile'))}$`,
            'i'
          )
        })
        .click()
    }
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
    await this.runAction(
      new RegExp(escapeRegExp(t('actions.duplicateTo.label')), 'i'),
      {
        button: new RegExp(escapeRegExp(t('DuplicateModal.confirmLabel')), 'i'),
        wait: 'optional'
      }
    )
  }

  /** The confirmation names the file, so it acts on this row alone. */
  async sendToTrash(open?: () => Promise<Locator>): Promise<void> {
    await this.runAction(
      new RegExp(`^${escapeRegExp(t('SelectionBar.trash'))}$`, 'i'),
      {
        button: new RegExp(`^${escapeRegExp(t('DeleteConfirm.delete'))}$`, 'i'),
        wait: 'required',
        title: t('DeleteConfirm.title', {
          filename: this.name.replace(/\.[^.]+$/, ''),
          smart_count: 1
        })
      },
      open
    )
    await this.waitHidden()
  }

  async download(): Promise<Download> {
    const menu = await this.openMenu()
    const download = this.page.waitForEvent('download')
    await menu
      .getByRole('menuitem', {
        name: new RegExp(`^${escapeRegExp(t('SelectionBar.download'))}$`, 'i')
      })
      .click()
    return await download
  }

  async addToFavorites(): Promise<void> {
    await this.runAction(
      new RegExp(escapeRegExp(t('favorites.label.add')), 'i')
    )
  }

  /** Open the row's action menu and click "Share", then return a ready-to-use
   *  ShareModalPage. Use this when the toolbar's Share button is unavailable
   *  (e.g. when acting on a file, which has no folder-scoped toolbar). */
  async share(): Promise<ShareModalPage> {
    const menu = await this.openMenu()
    await menu
      .getByRole('menuitem', {
        name: new RegExp(`^${escapeRegExp(t('Files.share.cta'))}$`, 'i')
      })
      .click()
    const modal = new ShareModalPage(this.page)
    await modal.waitForOpen()
    return modal
  }

  async leaveSharing(): Promise<void> {
    const menu = await this.openMenu()
    await menu
      .getByRole('menuitem', {
        name: new RegExp(
          escapeRegExp(t('toolbar.menu_leave_shared_drive')),
          'i'
        )
      })
      .click()
  }

  async restore(): Promise<void> {
    await this.runAction(
      new RegExp(`^${escapeRegExp(t('SelectionBar.restore'))}$`, 'i')
    )
    await this.waitHidden()
  }

  /** Bin only. */
  async deletePermanently(): Promise<void> {
    await this.runAction(
      new RegExp(`^${escapeRegExp(t('SelectionBar.destroy'))}$`, 'i'),
      {
        button: new RegExp(
          `^${escapeRegExp(t('DestroyConfirm.delete'))}$`,
          'i'
        ),
        wait: 'required'
      }
    )
    await this.waitHidden()
  }
}
