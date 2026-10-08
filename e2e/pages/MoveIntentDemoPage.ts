import type { Page } from '@playwright/test'

import { FilePickerPage } from './FilePickerPage'
import { MoveIntentPage, type MovedIntentFile } from './MoveIntentPage'
import { USERS, type User } from '../helpers/config'
import { expect } from '../helpers/fixtures'

interface DemoOptions {
  sourceNames: string[]
  directoryName?: string
  restrictToDefaultDir?: boolean
  driveOnly?: boolean
}

export class MoveIntentDemoPage extends MoveIntentPage {
  readonly #page: Page
  readonly #user: User

  constructor(page: Page, user: User = USERS.alice) {
    super(page, user)
    this.#page = page
    this.#user = user
  }

  async visit(): Promise<void> {
    await this.#page.goto(`${this.#user.appUrl}/#/move-intent-demo`)
  }

  async start(options: DemoOptions): Promise<void> {
    await this.prepare(options)
    await this.openMove()
  }

  async prepare(options: DemoOptions): Promise<void> {
    await this.visit()
    await expect(this.#page.getByRole('alert')).toContainText(
      'This demo really moves your files.'
    )
    const open = this.#page.getByRole('button', {
      name: 'Open MOVE demo',
      exact: true
    })
    await expect(open).toBeDisabled()
    const demo = this.#page.getByTestId('move-intent-demo')
    await expect(demo.getByRole('textbox')).toHaveCount(0)
    await expect(
      demo.getByRole('checkbox', { name: /I understand/ })
    ).toHaveCount(0)
    await expect(demo.getByTestId('move-demo-options')).toBeVisible()
    await this.chooseSources(options.sourceNames)
    if (options.directoryName)
      await this.chooseDirectory(options.directoryName, options.sourceNames[0])
    if (options.restrictToDefaultDir)
      await this.#page
        .getByRole('checkbox', { name: /Restrict destinations/ })
        .check()
    if (options.driveOnly)
      await this.#page.getByLabel('Drive only', { exact: true }).check()
    await expect(open).toBeEnabled()
  }

  async openMove(waitReady = true): Promise<void> {
    await this.#page
      .getByRole('button', { name: 'Open MOVE demo', exact: true })
      .click()
    if (waitReady) await this.waitReady()
  }

  async chooseSources(names: string[]): Promise<void> {
    await this.#page
      .getByRole('button', { name: 'Choose local files', exact: true })
      .click()
    const frame = this.#page.frameLocator('iframe[src*="intents"]')
    await expect(frame.getByRole('tab')).toHaveText(['My Drive'])
    await expect(frame.getByTestId('public-link-btn')).toHaveCount(0)
    await expect(frame.getByTestId('temporary-download-link-btn')).toHaveCount(
      0
    )
    const picker = new FilePickerPage(this.#page, this.#user)
    const isMobile = (this.#page.viewportSize()?.width ?? 1280) < 600
    for (const name of names) {
      await picker.scrollToItem(name)
      if (isMobile) await picker.tapItem(name)
      else await picker.toggleItem(name)
    }
    if (isMobile) {
      await expect(frame.getByTestId('file-picker-selected-count')).toHaveText(
        String(names.length)
      )
    } else {
      await expect(
        frame
          .getByRole('contentinfo')
          .getByText(
            `${names.length} ${names.length === 1 ? 'item' : 'items'} selected`,
            { exact: true }
          )
      ).toBeVisible()
    }
    await picker.clickDocumentsButton()
    await expect(this.#page.locator('iframe[src*="intents"]')).toHaveCount(0)
    await expect(
      this.#page.getByTestId('move-demo-sources').getByRole('listitem')
    ).toHaveText(names)
    await expect(this.#page.getByTestId('move-demo-result')).toHaveCount(0)
  }

  async chooseDirectory(name: string, fileName: string): Promise<void> {
    await this.#page
      .getByRole('button', { name: 'Choose default folder', exact: true })
      .click()
    const frame = this.#page.frameLocator('iframe[src*="intents"]')
    await expect(frame.getByRole('tab')).toHaveText(['My Drive'])
    await expect(frame.getByTestId('public-link-btn')).toHaveCount(0)
    await expect(frame.getByTestId('temporary-download-link-btn')).toHaveCount(
      0
    )
    const picker = new FilePickerPage(this.#page, this.#user)
    const isMobile = (this.#page.viewportSize()?.width ?? 1280) < 600
    await picker.scrollToItem(fileName)
    if (isMobile) await picker.tapItem(fileName)
    else await picker.selectItem(fileName)
    await expect(picker.documentsButton()).toBeDisabled()
    await picker.scrollToItem(name)
    if (isMobile) await picker.longPressItem(name)
    else await picker.selectItem(name)
    await picker.clickDocumentsButton()
    await expect(this.#page.locator('iframe[src*="intents"]')).toHaveCount(0)
    await expect(this.#page.getByTestId('move-demo-directory')).toContainText(
      name
    )
  }

  async waitReady(): Promise<void> {
    await expect(this.#page.getByTestId('move-demo-outcome')).toHaveText(
      'Destination picker ready. This does not mean files have moved.'
    )
    await expect(
      this.#page
        .frameLocator('iframe[src*="intents"]')
        .getByTestId('move-intent')
    ).toBeVisible()
  }

  async waitResult(): Promise<MovedIntentFile[]> {
    await expect(this.#page.getByTestId('move-demo-outcome')).toContainText(
      'Completed. Returned files:'
    )
    await expect(this.#page.locator('iframe[src*="intents"]')).toHaveCount(0)
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
    const text = await this.#page.getByTestId('move-demo-result').textContent()
    const documents: unknown = JSON.parse(text || 'null')
    if (!Array.isArray(documents)) throw new Error('Missing demo documents')
    for (const document of documents) {
      expect(document).toMatchObject({
        _id: expect.any(String),
        _rev: expect.any(String),
        _type: 'io.cozy.files',
        type: 'file',
        name: expect.any(String),
        dir_id: expect.any(String),
        path: expect.any(String)
      })
    }
    return documents as MovedIntentFile[]
  }

  async expectDismissed(): Promise<void> {
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
    await expect(this.#page.getByTestId('move-demo-result')).toHaveCount(0)
    await expect(this.#page.getByTestId('move-demo-outcome')).toHaveText(
      'Cancelled; no result returned. Completed moves, if any, remain.'
    )
  }

  async expectBusy(): Promise<void> {
    const frame = this.#page.frameLocator('iframe[src*="intents"]')
    await expect(
      frame.getByRole('button', { name: 'Move', exact: true })
    ).toBeDisabled()
    await expect(
      frame.getByRole('button', { name: 'Cancel', exact: true })
    ).toBeDisabled()
    await expect(
      this.#page
        .getByRole('dialog')
        .getByRole('button', { name: 'Close', exact: true })
    ).toHaveCount(0)
    await this.#page.keyboard.press('Escape')
    const dialog = this.#page.getByRole('dialog')
    const bounds = await dialog.boundingBox()
    if (!bounds) throw new Error('Missing busy dialog')
    expect(bounds.x).toBeGreaterThan(1)
    expect(bounds.y).toBeGreaterThan(1)
    // Dialog handles backdrop mouse-down/up on the paper's parent container.
    await dialog.locator('..').click({ position: { x: 1, y: 1 } })
    await expect(dialog).toBeVisible()
    await expect(
      frame.getByRole('button', { name: 'Cancel', exact: true })
    ).toBeDisabled()
    await expect(this.#page.getByTestId('move-demo-result')).toHaveCount(0)
  }

  async expectTerminalError(): Promise<void> {
    await expect(this.#page.getByRole('dialog')).toContainText(
      'MOVE sources must be accessible local files'
    )
    await expect(this.#page.getByTestId('move-demo-result')).toHaveCount(0)
    await this.#page.reload()
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
    await expect(this.#page.getByTestId('move-demo-sources')).toHaveCount(0)
    await expect(
      this.#page.getByRole('button', { name: 'Open MOVE demo', exact: true })
    ).toBeDisabled()
  }

  async expectUnavailable(): Promise<void> {
    await this.visit()
    await expect(this.#page.getByTestId('move-intent-demo')).toHaveCount(0)
    await expect(
      this.#page.getByRole('link', { name: 'MOVE intent demo', exact: true })
    ).toHaveCount(0)
  }

  async followSidebarLink(): Promise<void> {
    await this.#page.goto(`${this.#user.appUrl}/#/folder`)
    await this.#page.reload()
    await this.#page
      .getByRole('link', { name: 'MOVE intent demo', exact: true })
      .click()
    await expect(this.#page.getByTestId('move-intent-demo')).toBeVisible()
  }

  async expectFullScreenTouch(): Promise<void> {
    const viewport = this.#page.viewportSize()
    if (!viewport) throw new Error('Missing viewport')
    expect(viewport.width).toBeLessThan(600)
    expect(
      await this.#page.evaluate(() => navigator.maxTouchPoints)
    ).toBeGreaterThan(0)
    expect(await this.#page.getByRole('dialog').boundingBox()).toEqual({
      x: 0,
      y: 0,
      ...viewport
    })
  }
}
