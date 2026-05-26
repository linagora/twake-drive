import type { Page, Locator } from '@playwright/test'

export class SharedDriveModalPage {
  private readonly page: Page
  private readonly dialog: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.getByRole('dialog')
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
  }

  async setName(name: string): Promise<void> {
    const input = this.dialog.getByRole('textbox').first()
    await input.fill(name)
  }

  async confirm(): Promise<void> {
    await this.dialog
      .getByRole('button', { name: /create|confirm|ok/i })
      .click()
  }

  async waitForClose(): Promise<void> {
    await this.dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  }
}
