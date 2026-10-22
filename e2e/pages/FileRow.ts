import type { Page, Locator } from '@playwright/test'

import { MoveToPage } from './MoveToPage'
import { ShareModalPage } from './ShareModalPage'
import type { FileListRequests } from '../helpers/fileListRequests'
import { escapeRegExp, expect } from '../helpers/fixtures'

import { DOUBLE_CLICK_DELAY } from '@/hooks/useOnLongPress/helpers'

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
    private readonly name: string,
    private readonly fileRequests: FileListRequests
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
      .or(this.fileList.getByTitle(this.name, { exact: true }))
  }

  private get rowEl(): Locator {
    return this.cell.locator(
      'xpath=ancestor::*[.//button[@aria-label="More" or @arial-label="More"]][1]'
    )
  }

  private get actionButton(): Locator {
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
      const maxScrollTop = element.scrollHeight - element.clientHeight
      element.scrollTop =
        element.scrollTop >= maxScrollTop
          ? 0
          : Math.min(
              element.scrollTop +
                Math.max(1, Math.floor(element.clientHeight / 2)),
              maxScrollTop
            )
    })
  }

  /** Check all list pages: unmounted rows can still contain the file. */
  async waitHidden(opts?: { timeout?: number }): Promise<void> {
    const timeout: number = opts?.timeout ?? 10_000
    const scroller: Locator = this.fileList
      .locator('xpath=ancestor::*[@data-testid="virtuoso-scroller"][1]')
      .or(this.fileList)
      .first()
    const waitForRows = async (): Promise<void> => {
      await this.page.evaluate(
        () =>
          new Promise<void>(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      )
    }
    const isAtEnd = async (): Promise<boolean> =>
      scroller.evaluate(
        (element: HTMLElement) =>
          element.scrollTop + element.clientHeight >= element.scrollHeight - 1
      )

    await expect(async () => {
      await this.fileList.waitFor({ state: 'visible', timeout })
      await this.page
        .getByTestId('empty-folder')
        .or(
          this.fileList.locator(
            '[data-file-id], [data-testid="fil-file-filename-and-ext"]'
          )
        )
        .first()
        .waitFor({ state: 'attached', timeout })
      const scrollTop: number = await scroller.evaluate(
        (element: HTMLElement) => element.scrollTop
      )
      try {
        await scroller.evaluate((element: HTMLElement) => {
          element.scrollTop = 0
        })
        while (true) {
          await waitForRows()
          expect(
            await this.cell.count(),
            `Expected file "${this.name}" to be absent`
          ).toBe(0)
          if (await isAtEnd()) {
            // Wait for pagination, not DataProxy's long-lived script requests.
            await expect
              .poll(() => this.fileRequests.pending.size, {
                intervals: [50],
                timeout
              })
              .toBe(0)
            await waitForRows()
            expect(
              await this.cell.count(),
              `Expected file "${this.name}" to be absent`
            ).toBe(0)
            if (await isAtEnd()) return
          }
          await scroller.evaluate((element: HTMLElement) => {
            element.scrollTop += Math.max(
              1,
              Math.floor(element.clientHeight / 2)
            )
          })
        }
      } finally {
        await scroller.evaluate((element: HTMLElement, top: number) => {
          element.scrollTop = top
        }, scrollTop)
        await waitForRows()
      }
    }).toPass({ intervals: [100], timeout })
  }

  async isNewSharingShortcut(): Promise<boolean> {
    return this.rowEl.getByLabel('New sharing shortcut').isVisible()
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
    await this.waitVisible()
    await this.rowEl
      .getByRole('link')
      .first()
      .click({ modifiers: ['ControlOrMeta'] })
  }

  async open(): Promise<void> {
    await this.waitVisible()
    const link = this.rowEl.getByRole('link').first()
    // FileOpener uses cozy-ui's desktop breakpoint, not touch capability.
    const isDesktop: boolean = await this.page.evaluate(
      () => window.matchMedia('(min-width: 1024px)').matches
    )
    if (!isDesktop) {
      await link.click()
      return
    }
    // Virtuoso can reuse a row whose last click just opened its parent.
    await this.page.waitForTimeout(DOUBLE_CLICK_DELAY)
    await link.dblclick()
  }

  async openMenu(): Promise<Locator> {
    await this.waitVisible()
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
    const menuItem = menu.getByRole('menuitem', { name: /move to/i })
    if (await menuItem.isVisible()) {
      await menuItem.click()
    } else {
      await this.page.getByRole('button', { name: /^move$/i }).click()
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
