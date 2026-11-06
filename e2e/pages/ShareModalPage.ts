import type { Page, Locator } from '@playwright/test'

import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

type Role = 'Viewer' | 'Editor'

/** The label the app renders for a role. */
const roleLabel = (role: Role): string =>
  t(
    role === 'Editor'
      ? 'cozy-sharing:Share.type.two-way'
      : 'cozy-sharing:Share.type.one-way'
  )

const anyRoleLabel = (): string =>
  `${escapeRegExp(roleLabel('Viewer'))}|${escapeRegExp(roleLabel('Editor'))}`

export class ShareModalPage {
  private readonly page: Page
  /** The modal dialog — exposed so tests can assert its inner elements. */
  readonly dialog: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.getByRole('dialog')
  }

  /** Send button of the invite field. */
  get shareButton(): Locator {
    return this.dialog.getByRole('button', {
      name: new RegExp(
        `^${escapeRegExp(t('cozy-sharing:MemberAutocomplete.send'))}$`,
        'i'
      )
    })
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
  }

  /** Validates the typed email: the field turns it into the matching contact
   * when one is suggested, whose suggestion may show its instance rather than
   * its email, so the suggestion itself is not clicked. */
  async addMember(email: string): Promise<void> {
    const contactInput = this.dialog.getByRole('textbox').first()
    await contactInput.fill(email)
    await contactInput.press('Enter')
    await expect(contactInput).toHaveValue('')
  }

  /** Pick the role granted to the members being added. The selector is the
   * dropdown button sitting inside the recipient combobox (next to the
   * contact input) — the per-member role buttons in the list below are
   * outside the combobox, so they can't be confused with it. The role menu
   * itself is portal'd outside the dialog. */
  async setNewMemberRole(role: 'Viewer' | 'Editor'): Promise<void> {
    await this.dialog
      .getByRole('combobox')
      .getByRole('button', { name: new RegExp(`^(${anyRoleLabel()})$`, 'i') })
      .click()
    const menu = this.page.getByRole('menu')
    await menu
      .getByRole('menuitem', {
        name: new RegExp(`^${escapeRegExp(roleLabel(role))}$`, 'i')
      })
      .click()
    await menu.waitFor({ state: 'hidden' })
  }

  /** Opens the role menu for an already-added member and picks `role`,
   * without handling any confirm dialog that might follow. Use this instead
   * of setMemberRole when the test needs to interact with
   * DowngradePermissionConfirmDialog itself (DowngradeConfirmDialogPage). */
  async selectMemberRole(
    nameOrEmail: string,
    role: 'Viewer' | 'Editor'
  ): Promise<void> {
    await this.memberRole(nameOrEmail).click()
    const menu = this.page.getByRole('menu')
    await menu
      .getByRole('menuitem', {
        name: new RegExp(`^${escapeRegExp(roleLabel(role))}$`, 'i')
      })
      .click()
    await menu.waitFor({ state: 'hidden' })
  }

  /** Same as selectMemberRole, but also confirms the second, stacked confirm
   * dialog (DowngradePermissionConfirmDialog) interposed when downgrading a
   * member on a folder that has a shared parent — only if it shows up
   * within a short grace window, same pattern as removeMember. */
  async setMemberRole(
    nameOrEmail: string,
    role: 'Viewer' | 'Editor'
  ): Promise<void> {
    await this.selectMemberRole(nameOrEmail, role)

    const confirmButton = this.page
      .getByRole('dialog')
      .filter({
        has: this.page.getByRole('button', {
          name: t('cozy-sharing:DowngradePermissionConfirmDialog.confirm')
        })
      })
      .last()
      .getByRole('button', {
        name: t('cozy-sharing:DowngradePermissionConfirmDialog.confirm')
      })
    const appeared = await confirmButton
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch((err: Error) => {
        if (err.name === 'TimeoutError') return false
        throw err
      })
    if (appeared) await confirmButton.click()
  }

  /** Row of an already-added member in the dialog's member list. Matches on
   * any text in the row (display name, email or instance URL). */
  memberItem(nameOrEmail: string): Locator {
    return this.dialog.getByRole('listitem').filter({ hasText: nameOrEmail })
  }

  /** Role dropdown button ("Editor"/"Viewer") of a confirmed member row.
   * Only rendered for confirmed members, never for pending ones or the owner. */
  memberRole(nameOrEmail: string): Locator {
    return this.memberItem(nameOrEmail)
      .getByRole('button')
      .filter({ hasText: new RegExp(`^(${anyRoleLabel()})$`, 'i') })
  }

  /** Remove/revoke button of a member row. */
  memberRemoveButton(nameOrEmail: string): Locator {
    return this.memberItem(nameOrEmail).getByRole('button', {
      name: new RegExp(
        escapeRegExp(t('cozy-ui-member-row:MemberRow.remove')),
        'i'
      )
    })
  }

  /** Revoke a member's access from the member list. Some cozy-sharing
   * versions interpose a confirm dialog, some don't — confirm only if one
   * shows up within a short grace window. */
  async removeMember(nameOrEmail: string): Promise<void> {
    await this.memberItem(nameOrEmail)
      .getByRole('button', {
        name: new RegExp(
          escapeRegExp(t('cozy-ui-member-row:MemberRow.remove')),
          'i'
        )
      })
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

  /** Sends the invitations from the field, then closes the modal, which
   * stays open after sending. The field hides its placeholder while members
   * are picked and shows it again once the invitations are sent. The name is
   * anchored so it can't also match "Copy link" or "Send link". */
  async share(): Promise<void> {
    await this.shareButton.click()
    await expect(this.dialog.getByRole('textbox').first()).toHaveAttribute(
      'placeholder',
      /.+/,
      { timeout: 15_000 }
    )
    await this.close()
  }

  async close(): Promise<void> {
    await this.dialog.getByRole('button', { name: /close/i }).click()
    await this.dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  }
}
