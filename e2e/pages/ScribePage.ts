import type { FrameLocator, Locator, Page } from '@playwright/test'

import { expect } from '../helpers/fixtures'

/**
 * Drive's chrome around the scribe of an OnlyOffice document: the AI button
 * of the toolbar and the panel that holds the assistant
 */
export class ScribePage {
  constructor(private readonly page: Page) {}

  /** Opens a document in OnlyOffice and waits for the AI button */
  async openDocument(appUrl: string, fileId: string): Promise<void> {
    await this.page.goto(`${appUrl}/#/onlyoffice/${fileId}`)
    await expect(this.page.locator('iframe[name="frameEditor"]')).toBeVisible({
      timeout: 90_000
    })
    // The button shows once the plugin has told Drive it is ready
    await expect(this.toolbarButton()).toBeVisible({ timeout: 90_000 })
  }

  toolbarButton(): Locator {
    return this.page.getByRole('button', { name: 'Help me write' })
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
