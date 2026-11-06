import type { Page, Locator } from '@playwright/test'

import { t } from '../helpers/i18n'

export class TrashPage {
  constructor(private readonly page: Page) {}

  get emptyState(): Locator {
    return this.page.getByRole('heading', { name: t('empty.trash_title') })
  }

  async emptyTrash(): Promise<void> {
    await this.page
      .getByRole('button', { name: t('TrashToolbar.emptyTrash') })
      .click()
    const dialog = this.page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible' })
    await dialog
      .getByRole('button', { name: t('EmptyTrashConfirm.delete'), exact: true })
      .click()
    await dialog.waitFor({ state: 'hidden' })
  }
}
