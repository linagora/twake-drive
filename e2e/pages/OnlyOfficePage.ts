import type { FrameLocator, Locator, Page } from '@playwright/test'

import type { FileRow } from './FileRow'
import { ShareModalPage } from './ShareModalPage'
import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

export class OnlyOfficePage {
  constructor(private readonly page: Page) {}

  /** Drive only listens to onAppReady, which the editor sends before the
   * Document Server has fetched the file: wrap the editor of the page so its
   * onDocumentReady leaves a mark. Call it before the page opens the editor. */
  async watchDocumentReady(): Promise<void> {
    await this.page.addInitScript(() => {
      const marked = window as unknown as Record<string, unknown>
      let api: Record<string, unknown> | undefined
      Object.defineProperty(window, 'DocsAPI', {
        configurable: true,
        get: () => api,
        set: (value: Record<string, unknown>) => {
          let editor: unknown
          Object.defineProperty(value, 'DocEditor', {
            configurable: true,
            get: () => editor,
            set: (Original: new (id: string, config: object) => object) => {
              const Wrapped = function (
                id: string,
                config: { events?: Record<string, unknown> }
              ): object {
                const ownHandler = config.events?.onDocumentReady
                config.events = {
                  ...config.events,
                  onDocumentReady: (...args: unknown[]) => {
                    marked.__officeDocumentReady = true
                    if (typeof ownHandler === 'function') ownHandler(...args)
                  }
                }
                return new Original(id, config)
              }
              editor = Object.assign(Wrapped, Original)
            }
          })
          api = value
        }
      })
    })
  }

  async expectEditorOpen(): Promise<void> {
    await expect(this.page.locator('iframe[name="frameEditor"]')).toBeVisible()
  }

  /** Waits for the document itself, once watchDocumentReady is set. */
  async waitForDocumentReady(): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate(
            () =>
              (window as unknown as Record<string, unknown>)
                .__officeDocumentReady === true
          ),
        { timeout: 90_000 }
      )
      .toBe(true)
  }

  /** The Share button of the toolbar of Drive above the editor. */
  async openShareModal(): Promise<ShareModalPage> {
    await this.page.getByTestId('onlyoffice-sharing-button').click()
    // The editor is a full-screen dialog of its own
    const modal = new ShareModalPage(
      this.page,
      this.page
        .getByRole('dialog')
        .filter({ hasNot: this.page.locator('iframe[name="frameEditor"]') })
    )
    await modal.waitForOpen()
    return modal
  }

  async openFromRow(
    row: FileRow,
    fileId: string,
    documentType: 'word' | 'pdf' = 'word'
  ): Promise<void> {
    const configResponse = this.page.waitForResponse(
      response => response.url().includes(`/office/${fileId}/open`),
      { timeout: 60_000 }
    )

    await row.open()
    await expect(this.page).toHaveURL(
      new RegExp(`/onlyoffice/${escapeRegExp(fileId)}`)
    )

    const response = await configResponse
    expect(response.ok()).toBe(true)
    const body = (await response.json()) as {
      data: { attributes: { onlyoffice: { documentType: string } } }
    }
    expect(body.data.attributes.onlyoffice.documentType).toBe(documentType)

    await expect(this.page.getByTestId('onlyoffice-title')).toBeVisible()
    await expect(this.page.locator('iframe[name="frameEditor"]')).toBeVisible({
      timeout: 90_000
    })
    await expect(
      this.page
        .frameLocator('iframe[name="frameEditor"]')
        .getByText('Page 1 of 1')
    ).toBeVisible({ timeout: 90_000 })
  }

  /** Shown when the file changes on the stack while it is being edited. */
  get divergedNotice(): Locator {
    return this.page.getByText(t('FileDivergedModal.title'), { exact: true })
  }

  private get editor(): FrameLocator {
    return this.page.frameLocator('iframe[name="frameEditor"]')
  }

  /** Wait for a text document to load, and answer the name prompt the
   * editor shows once per browser for collaboration. */
  async waitForTextEditor(userName: string): Promise<void> {
    await expect(this.editor.getByText('Page 1 of 1')).toBeVisible({
      timeout: 90_000
    })
    const nameInput = this.editor.locator('#id-dlg-username-caption input')
    const asked = await nameInput
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch((err: Error) => {
        if (err.name === 'TimeoutError') return false
        throw err
      })
    if (!asked) return
    await nameInput.fill(userName)
    await nameInput.press('Enter')
    await expect(nameInput).toBeHidden()
  }

  /** "All changes saved" only means the Document Server has the edit: the
   * stack gets it through the save callback once the editor is closed. */
  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text, { delay: 30 })
    await expect(this.editor.getByText('All changes saved')).toBeVisible({
      timeout: 30_000
    })
  }

  async back(): Promise<void> {
    await this.page
      .getByRole('button', { name: t('button.back') })
      .first()
      .click()
    await this.page.waitForURL(/#\/folder\/[^/]+$/)
    // The Create menu opens again after a document created with it, see
    // linagora/twake-drive#4328
    const menu = this.page.getByRole('menu')
    const reopened = await menu
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch((err: Error) => {
        if (err.name === 'TimeoutError') return false
        throw err
      })
    if (!reopened) return
    await this.page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
  }

  /** Shown when the file goes to the Bin while it is being edited. */
  get deletedNotice(): Locator {
    return this.page.getByText(t('FileDeletedModal.title'), { exact: true })
  }

  async restoreDeletedFile(): Promise<void> {
    await this.page
      .getByRole('button', { name: t('FileDeletedModal.confirm') })
      .click()
    await this.deletedNotice.waitFor({ state: 'hidden' })
  }
}
