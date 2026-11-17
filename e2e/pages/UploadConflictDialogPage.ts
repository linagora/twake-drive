import type { Page, Locator } from '@playwright/test'

import { escapeRegExp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

const exactly = (key: string): RegExp =>
  new RegExp(`^${escapeRegExp(t(key))}$`, 'i')

/** "Upload options", shown when an upload has the name of an existing file. */
export class UploadConflictDialogPage {
  private readonly dialog: Locator

  constructor(page: Page) {
    this.dialog = page
      .getByRole('dialog')
      .filter({ hasText: t('upload.conflict.title') })
  }

  async replace(): Promise<void> {
    await this.choose('upload.conflict.replace')
  }

  async keepBoth(): Promise<void> {
    await this.choose('upload.conflict.keep_both')
  }

  async cancel(): Promise<void> {
    await this.dialog
      .getByRole('button', { name: exactly('upload.conflict.cancel') })
      .click()
    await this.dialog.waitFor({ state: 'hidden' })
  }

  private async choose(optionKey: string): Promise<void> {
    await this.dialog.getByRole('radio', { name: t(optionKey) }).check()
    await this.dialog
      .getByRole('button', { name: exactly('upload.conflict.confirm') })
      .click()
    await this.dialog.waitFor({ state: 'hidden' })
  }
}
