import type { Page, Locator } from '@playwright/test'

/**
 * Drives the "share by link" flow inside the share modal.
 *
 * The public link is not created up front: clicking "Copy link" generates it
 * (and copies it to the clipboard), after which a "link recipient" row appears
 * with a cog. Clicking that row opens the ShareRestrictionModal where password
 * and expiration are configured.
 *
 * Assumes the share modal is already open. Label matching assumes English.
 */
export class ShareByLinkPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** The link recipient row, present only once a link exists. Its text flips
   * to "Anyone with a password" after a password is set. */
  private get linkRow(): Locator {
    return this.page.getByText(/Anyone with (the link|a password)/)
  }

  /** The ShareRestrictionModal is a second dialog stacked over the share
   * modal; scope to it by its "Sharing link" title so its toggles and Confirm
   * button don't collide with the share modal underneath. */
  private get restrictionModal(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Sharing link' })
  }

  /** Generate the public link via "Copy link" and return the copied URL. The
   * link is created server-side here, but the link recipient row only renders
   * after the modal re-fetches permissions, so callers reopen the modal (see
   * waitForLinkRow) before opening restrictions. The caller's browser context
   * must have clipboard permissions granted. */
  async createLink(): Promise<string> {
    await this.page.getByRole('button', { name: 'Copy link' }).click()
    // The link is generated asynchronously and only then copied, so poll the
    // clipboard until the URL lands rather than reading it immediately.
    await this.page.waitForFunction(
      async () => /^https?:\/\//.test(await navigator.clipboard.readText()),
      null,
      { timeout: 10_000 }
    )
    return this.page.evaluate(() => navigator.clipboard.readText())
  }

  /** Wait for the link recipient row to be present (after a modal reopen). */
  async waitForLinkRow(): Promise<void> {
    await this.linkRow.waitFor({ state: 'visible' })
  }

  /** Open the restriction modal by clicking the link recipient row (its cog). */
  async openRestrictions(): Promise<void> {
    await this.linkRow.click()
    await this.restrictionModal.waitFor({ state: 'visible' })
  }

  /** Toggle password protection on and fill the password field. */
  async enablePassword(password: string): Promise<void> {
    const modal = this.restrictionModal
    await modal.getByText('Limit access with a password').click()
    await modal.getByLabel('Password').fill(password)
  }

  /** `date` must already be formatted for the current locale (MM/dd/yyyy in
   * English); the cozy-ui DatePicker has `enableKeyboard`, so we type it
   * rather than navigating the calendar popup. */
  async enableExpiration(date: string): Promise<void> {
    const modal = this.restrictionModal
    await modal.getByText('Remove access after a deadline').click()
    // The DatePicker's label "Deadline" is also the icon button's aria-label,
    // so match the date input by its numeric inputmode (the only one here).
    await modal.locator('input[inputmode="numeric"]').fill(date)
  }

  /** Confirm the restriction modal and wait for it to close. */
  async confirm(): Promise<void> {
    await this.restrictionModal
      .getByRole('button', { name: 'Confirm' })
      .click()
    await this.restrictionModal.waitFor({ state: 'hidden', timeout: 15_000 })
  }
}
