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

  /** Pick the role granted to the members being added. The selector is the
   * dropdown button sitting inside the recipient combobox (next to the
   * contact input) — the per-member role buttons in the list below are
   * outside the combobox, so they can't be confused with it. The role menu
   * itself is portal'd outside the dialog. */
  async setNewMemberRole(role: 'Viewer' | 'Editor'): Promise<void> {
    await this.dialog.getByRole('combobox').getByRole('button').click()
    const menu = this.page.getByRole('menu')
    await menu
      .getByRole('menuitem', { name: new RegExp(`^${role}$`, 'i') })
      .click()
    await menu.waitFor({ state: 'hidden' })
  }

  /** Row of an already-added member in the dialog's member list. Matches on
   * any text in the row (display name, email or instance URL). */
  memberItem(nameOrEmail: string): Locator {
    return this.dialog.getByRole('listitem').filter({ hasText: nameOrEmail })
  }

  /** Revoke a member's access from the member list. Some cozy-sharing
   * versions interpose a confirm dialog, some don't — confirm only if one
   * shows up within a short grace window. */
  async removeMember(nameOrEmail: string): Promise<void> {
    await this.memberItem(nameOrEmail)
      .getByRole('button', { name: /remove from sharing/i })
      .click()
    // A confirm dialog, if it appears, is a SECOND dialog on top of this
    // share modal. Scope to the dialog that actually carries a revoke button
    // (not this modal) so the match can't hit a control in the share modal,
    // and drop the over-generic "ok".
    const confirmAction = /^(remove|revoke|confirm)$/i
    const confirmButton = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('button', { name: confirmAction }) })
      .last()
      .getByRole('button', { name: confirmAction })
    const appeared = await confirmButton
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch((err: Error) => {
        if (err.name === 'TimeoutError') return false
        throw err
      })
    if (appeared) await confirmButton.click()
    await this.memberItem(nameOrEmail).waitFor({
      state: 'hidden',
      timeout: 10_000
    })
  }

  /** Submits the share form and waits for the modal to close (success).
   * The name is anchored so it can't also match a link affordance like
   * "Send link" / "Copy link" or a "Shared with N" control that would
   * trip strict-mode. */
  async share(): Promise<void> {
    await this.dialog
      .getByRole('button', { name: /^(share|send|confirm|ok|done)$/i })
      .click()
    await this.dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  }

  async close(): Promise<void> {
    await this.dialog.getByRole('button', { name: /close/i }).click()
    await this.dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  }
}
