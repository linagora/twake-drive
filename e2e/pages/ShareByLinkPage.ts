import type { Page, Locator } from '@playwright/test'

import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

/**
 * Drives the "share by link" flow inside the share modal.
 *
 * The public link is not created up front: clicking "Copy link" generates it
 * (and copies it to the clipboard), after which the "Public access" row tells
 * who can open it. The cog next to the "Public access" title opens the
 * ShareRestrictionModal where password and expiration are configured.
 *
 * Assumes the share modal is already open. Label matching assumes English.
 */
export class ShareByLinkPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** The status of the "Public access" row once a link exists. It reads
   * "Only users added via email can open it" while there is no link. */
  private get linkRow(): Locator {
    const statuses = ['view', 'edit', 'password']
      .map(status =>
        escapeRegExp(t(`cozy-sharing:Share.publicAccess.status.${status}`))
      )
      .join('|')
    return this.page.getByText(new RegExp(`^(${statuses})`))
  }

  /** The ShareRestrictionModal is a second dialog stacked over the share
   * modal; scope to it by its "Sharing link settings" title so its toggles and
   * Confirm button don't collide with the share modal underneath. */
  private get restrictionModal(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ hasText: t('cozy-sharing:ShareRestrictionModal.title') })
  }

  /** Generate the public link via "Copy link" and return the copied URL. The
   * link is created server-side here, but the "Public access" row only updates
   * after the modal re-fetches permissions, so callers reopen the modal (see
   * waitForLinkRow) before opening restrictions. The caller's browser context
   * must have clipboard permissions granted. */
  async createLink(): Promise<string> {
    // The browser context is reused across tests, so the clipboard may
    // already hold the previous test's link URL. Capture it so the poll
    // below only resolves on a freshly generated URL — not just any URL.
    const previousUrl = await this.page.evaluate(() =>
      navigator.clipboard.readText().catch(() => '')
    )
    await this.page
      .getByRole('button', {
        name: t('cozy-sharing:Files.share.shareByLink.copy')
      })
      .click()
    // The link is generated asynchronously and only then copied, so poll
    // until the clipboard holds a URL different from the previous one.
    let text = ''
    await expect(async (): Promise<void> => {
      text = await this.page.evaluate(() =>
        navigator.clipboard.readText().catch(() => '')
      )
      expect(text).toMatch(/^https?:\/\//)
      expect(text).not.toBe(previousUrl)
    }).toPass({ intervals: [100], timeout: 15_000 })
    return text
  }

  /** Wait for the "Public access" row to tell a link exists (after a modal reopen). */
  async waitForLinkRow(): Promise<void> {
    await this.linkRow.waitFor({ state: 'visible' })
  }

  /** Open the restriction modal from the cog of the "Public access" block. */
  async openRestrictions(): Promise<void> {
    await this.page
      .getByRole('button', {
        name: t('cozy-sharing:Share.publicAccess.settings')
      })
      .click()
    await this.restrictionModal.waitFor({ state: 'visible' })
  }

  /** Toggle password protection on and fill the password field. */
  async enablePassword(password: string): Promise<void> {
    const modal = this.restrictionModal
    await modal.getByText(t('cozy-sharing:BoxPassword.text')).click()
    await modal
      .getByRole('textbox', {
        name: t('cozy-sharing:BoxPassword.label')
      })
      .fill(password)
  }

  /** `date` must already be formatted for the current locale (MM/dd/yyyy in
   * English); the cozy-ui DatePicker has `enableKeyboard`, so we type it
   * rather than navigating the calendar popup. */
  async enableExpiration(date: string): Promise<void> {
    const modal = this.restrictionModal
    await modal.getByText(t('cozy-sharing:BoxDate.text')).click()
    // The DatePicker's label "Deadline" is also the icon button's aria-label,
    // so match the date input by its numeric inputmode (the only one here).
    await modal.locator('input[inputmode="numeric"]').fill(date)
  }

  async allowEditing(): Promise<void> {
    const editor = t('cozy-sharing:Share.type.two-way')
    const viewer = t('cozy-sharing:Share.type.one-way')
    const recipient = this.page
      .getByRole('dialog')
      .filter({ has: this.linkRow })
      .getByRole('listitem')
      .filter({ has: this.linkRow })
    const roleButton = recipient.getByRole('button').filter({
      hasText: new RegExp(`^(${escapeRegExp(editor)}|${escapeRegExp(viewer)})$`)
    })
    await roleButton.click()
    const menu = this.page.getByRole('menu')
    await menu
      .getByRole('menuitem', {
        name: new RegExp(`^${escapeRegExp(editor)}$`)
      })
      .click()
    await menu.waitFor({ state: 'hidden' })
    await expect(roleButton).toHaveText(editor)
  }

  /** Confirm the restriction modal and wait for it to close. */
  async confirm(): Promise<void> {
    await this.restrictionModal
      .getByRole('button', {
        name: t('cozy-sharing:ShareRestrictionModal.action.confirm')
      })
      .click()
    await this.restrictionModal.waitFor({ state: 'hidden', timeout: 15_000 })
  }
}
