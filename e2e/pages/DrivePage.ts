import type { Page, Locator } from '@playwright/test'

import { FileRow } from './FileRow'
import { MoveToPage } from './MoveToPage'
import { ShareModalPage } from './ShareModalPage'
import { FileListRequests } from '../helpers/fileListRequests'
import { expect } from '../helpers/fixtures'

/**
 * Page object for the Drive file list view (My Drive, Trash, Favorites,
 * inside a folder or shared drive — anything that renders the standard
 * fil-content-body table). Per-row actions live on `FileRow` so callers
 * write `drive.row('foo').rename('bar')` instead of passing names through
 * many separate methods.
 */
export class DrivePage {
  private readonly page: Page
  private readonly fileRequests: FileListRequests

  constructor(page: Page) {
    this.page = page
    this.fileRequests = new FileListRequests(page)
  }

  /** Legacy empty views nest the message inside the table; prefer that ancestor. */
  get fileList(): Locator {
    return this.page
      .getByRole('table', { includeHidden: true })
      .or(this.page.getByTestId('empty-folder'))
      .first()
  }

  row(name: string): FileRow {
    return new FileRow(this.page, this.fileList, name, this.fileRequests)
  }

  get createButton(): Locator {
    return this.page.getByRole('button', { name: /^create$/i })
  }

  get uploadButton(): Locator {
    return this.page.getByRole('button', { name: /^upload$/i })
  }

  async selectRows(names: string[]): Promise<void> {
    if (names.length === 0) throw new Error('At least one row is required')
    for (const name of names) {
      await this.row(name).select()
    }
  }

  // Click the recipients avatars in the folder toolbar
  // to open the ShareModal for the folder itself
  async openShareFromToolbarRecipients(): Promise<ShareModalPage> {
    await this.page
      .getByTestId('fil-toolbar-files')
      .getByTestId(/^AvatarList-avatar/)
      .first()
      .click()
    const modal = new ShareModalPage(this.page)
    await modal.waitForOpen()
    return modal
  }

  async openMoveToForSelection(): Promise<MoveToPage> {
    await this.page.getByRole('button', { name: /move to/i }).click()
    const moveTo = new MoveToPage(this.page)
    await moveTo.waitForOpen()
    return moveTo
  }

  async openShareModal(): Promise<ShareModalPage> {
    await this.page.getByRole('button', { name: /share/i }).click()
    const shareModal = new ShareModalPage(this.page)
    await shareModal.waitForOpen()
    return shareModal
  }

  /** Open a folder and wait until its document has loaded. The route
   * changes before `displayedFolder` is ready, while Create and Upload derive
   * their destination from that document. The attached breadcrumb item
   * confirms that the folder query has completed; the current item can be
   * clipped by the breadcrumb's ellipsis and therefore not be visible. */
  async openFolder(name: string): Promise<void> {
    await this.row(name).open()
    await this.page.waitForURL(/\/folder\/[^/]+$/)
    const desktopBreadcrumb = this.page
      .getByRole('main')
      .getByRole('navigation')
      .getByText(name, { exact: true })
    const mobileHeading = this.page
      .getByRole('banner')
      .getByRole('heading', { name, exact: true })
    await desktopBreadcrumb.or(mobileHeading).waitFor({ state: 'attached' })
  }

  /** Locator for the file list cell whose filename contains the substring —
   *  use for "the original and its (1) copy" style multi-row assertions. */
  matching(stem: string): Locator {
    return this.fileList
      .getByTestId('fil-file-filename-and-ext')
      .filter({ hasText: stem })
      .or(this.fileList.getByTitle(stem, { exact: false }))
  }

  async createFolder(name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Create' }).click()
    await this.page.getByTestId('add-folder-link').click()
    const input = this.page.getByTestId('name-input').locator('input')
    await expect
      .poll(
        async (): Promise<number> => {
          const count = await input.count()
          if (count === 0) await this.scrollFileListToTop()
          return count
        },
        { intervals: [50], timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    await input.waitFor({ state: 'visible' })
    await input.fill(name)
    await input.press('Enter')
    await this.row(name).waitVisible()
  }

  /** cozy-ui's FileInput spreads extra props onto the underlying <input
   * type=file>, so the `upload-btn` testid lives on the input itself. */
  async uploadFiles(filePaths: string | string[]): Promise<void> {
    await this.fileList.waitFor({ state: 'visible' })
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

  /** Chromium supplies real filesystem entries, unlike a scripted DataTransfer. */
  async dropFiles(filePaths: string[]): Promise<void> {
    await this.fileList.waitFor({ state: 'visible' })
    const scroller: Locator = this.fileList.locator(
      'xpath=ancestor::*[@data-testid="virtuoso-scroller"][1]'
    )
    const dropTarget: Locator = scroller.or(this.fileList).first()
    await dropTarget.scrollIntoViewIfNeeded()
    const bounds = await dropTarget.boundingBox()
    if (!bounds) throw new Error('File list has no drop target')
    const session = await this.page.context().newCDPSession(this.page)
    try {
      for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
        await session.send('Input.dispatchDragEvent', {
          type,
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
          data: { items: [], files: filePaths, dragOperationsMask: 1 }
        })
      }
    } finally {
      await session.detach()
    }
  }

  private async scrollFileListToTop(): Promise<void> {
    const scroller = this.page.getByTestId('virtuoso-scroller')
    if ((await scroller.count()) === 0) return
    await scroller.evaluate((element: HTMLElement) => {
      element.scrollTop = 0
    })
  }

  /** Callers must be in an empty folder so the click opens AddMenu, not a row menu. */
  private async openAddContextMenu(): Promise<void> {
    await this.fileList.click({ button: 'right' })
    await this.page.getByRole('menu').waitFor({ state: 'visible' })
  }
}
