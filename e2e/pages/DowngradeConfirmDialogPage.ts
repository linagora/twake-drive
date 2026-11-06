import type { Page, Locator } from '@playwright/test'

import { escapeRegExp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

/** DowngradePermissionConfirmDialog — a second dialog stacked on top of the
 * ShareModal, interposed when downgrading a member's role (Editor→Viewer) on
 * a folder that has a shared parent. Use ShareModalPage.selectMemberRole to
 * trigger it without auto-confirming. */
export class DowngradeConfirmDialogPage {
  private readonly page: Page
  readonly dialog: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.getByRole('dialog', {
      name: new RegExp(
        escapeRegExp(t('cozy-sharing:DowngradePermissionConfirmDialog.title')),
        'i'
      )
    })
  }

  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' })
  }

  /** Row of the timeline naming a folder (the shared parent or the item
   * whose role is being changed). */
  folderRow(name: string): Locator {
    return this.dialog.getByRole('listitem').filter({ hasText: name })
  }

  /** The bolded contact name in the confirmation sentence. */
  contactName(): Locator {
    return this.dialog.locator('strong')
  }

  async cancel(): Promise<void> {
    await this.dialog
      .getByRole('button', {
        name: t('cozy-sharing:DowngradePermissionConfirmDialog.cancel')
      })
      .click()
    await this.dialog.waitFor({ state: 'hidden' })
  }

  async confirm(): Promise<void> {
    await this.dialog
      .getByRole('button', {
        name: t('cozy-sharing:DowngradePermissionConfirmDialog.confirm')
      })
      .click()
    await this.dialog.waitFor({ state: 'hidden' })
  }
}
