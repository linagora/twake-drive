import type { FrameLocator, Locator, Page } from '@playwright/test'

import { selectInEditor } from './ScribePluginPage'
import { expect } from '../helpers/fixtures'

// The button under the selection is an asset of 48 px that holds a disc of
// 24 px, 12 px inside its left edge and 9 px inside its top edge
const DISC = { left: 12, top: 9, size: 24 }
const WHEEL_TURN = 100

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Drive's chrome around the scribe of an OnlyOffice document: the AI button
 * of the toolbar, the button under the selection and the panel that holds
 * the assistant
 */
export class ScribePage {
  constructor(private readonly page: Page) {}

  /** Opens a document in OnlyOffice and waits for the AI button */
  async openDocument(appUrl: string, fileId: string): Promise<void> {
    await this.page.goto(`${appUrl}/#/onlyoffice/${fileId}`)
    await expect(this.editorFrame()).toBeVisible({
      timeout: 90_000
    })
    // The button shows once the plugin has told Drive it is ready
    await expect(this.toolbarButton()).toBeVisible({ timeout: 90_000 })
  }

  /**
   * Keeps what the plugin tells Drive, for `ScribePluginPage.takeGeometry`,
   * and still gives it to Drive
   */
  async watchMessages(): Promise<void> {
    await this.page.evaluate(() => {
      const messages: unknown[] = []
      Object.assign(window, { scribeMessages: messages })
      window.addEventListener('message', event => {
        const { type } = (event.data ?? {}) as { type?: unknown }
        if (typeof type === 'string' && type.startsWith('twake-scribe:')) {
          messages.push(event.data)
        }
      })
    })
  }

  /**
   * Selects in the document what a spec of the harness names. A selection is
   * then ended with the keyboard, as by a user: the editor tells its plugins
   * of a selection a user ends, not of one made by its API.
   */
  async selectInEditor(spec: string): Promise<void> {
    const editor = this.page.frame({ name: 'frameEditor' })
    if (!editor) throw new Error('No editor frame')
    const result = await editor.evaluate(selectInEditor, spec)
    if (!result.ok) throw new Error(result.error)
    if (!spec.includes('..')) return

    const area = editor.locator('#area_id')
    await area.press('Shift+ArrowLeft')
    await area.press('Shift+ArrowRight')
  }

  /**
   * Turns the mouse wheel over the document, 100 px a turn as a mouse does:
   * the editor scrolls a step for each turn, whatever its delta
   */
  async scrollEditor(deltaY: number): Promise<void> {
    const viewer = await this.page
      .frameLocator('iframe[name="frameEditor"]')
      .locator('#id_viewer')
      .boundingBox()
    if (!viewer) throw new Error('No viewer in the editor')
    await this.page.mouse.move(
      viewer.x + viewer.width / 2,
      viewer.y + viewer.height / 2
    )
    const turn = Math.sign(deltaY) * WHEEL_TURN
    for (let rest = Math.abs(deltaY); rest > 0; rest -= WHEEL_TURN) {
      await this.page.mouse.wheel(0, turn)
    }
  }

  editorFrame(): Locator {
    return this.page.locator('iframe[name="frameEditor"]')
  }

  toolbarButton(): Locator {
    return this.page.getByRole('button', { name: 'Help me write' })
  }

  selectionButton(): Locator {
    return this.page.getByRole('button', { name: 'Scribe Menu' })
  }

  /** The visible disc of the button under the selection */
  async selectionDiscBox(): Promise<Box | null> {
    const box = await this.selectionButton().boundingBox()
    if (!box) return null
    return {
      x: box.x + DISC.left,
      y: box.y + DISC.top,
      width: DISC.size,
      height: DISC.size
    }
  }

  panel(): Locator {
    return this.page.getByRole('complementary', { name: 'Help me write' })
  }

  assistantFrame(): FrameLocator {
    return this.panel().frameLocator('iframe')
  }

  async openPanel(): Promise<void> {
    await this.toolbarButton().click()
  }

  async closePanel(): Promise<void> {
    await this.toolbarButton().click()
  }
}
