import type { Page, Locator } from '@playwright/test'

export class ShareModalPage {
  private readonly page: Page
  private readonly dialog: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.getByRole('dialog')
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
  }

  async addMember(email: string): Promise<void> {
    const contactInput = this.dialog.getByRole('textbox').first()
    await contactInput.fill(email)
    // Either click a matching autocomplete suggestion (existing contact) or
    // press Enter (free-form email input). The suggestion listbox is
    // portal'd outside the dialog so we have to match on the page; the
    // hasText filter keeps the lookup scoped to options that actually
    // contain the email we typed.
    const suggestion = this.page
      .getByRole('option')
      .filter({ hasText: email })
      .first()
    if (await suggestion.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await suggestion.click()
    } else {
      await contactInput.press('Enter')
    }
  }

  /** Submits the share form and waits for the modal to close (success). */
  async share(): Promise<void> {
    await this.dialog
      .getByRole('button', { name: /share|send|confirm|ok/i })
      .click()
    await this.dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  }

  async close(): Promise<void> {
    await this.dialog.getByRole('button', { name: /close/i }).click()
    await this.dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  }
}
