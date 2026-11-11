import type { Locator, Page } from '@playwright/test'

import { escapeRegExp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

/** The dialog shown when an upload goes over the disk quota. Its title
 * depends on whether the instance offers plans. */
export class QuotaPaywallPage {
  readonly dialog: Locator

  constructor(page: Page) {
    const titles = ['premium', 'default']
      .map(type =>
        escapeRegExp(t(`cozy-ui-plus-paywall:quotaPaywall.${type}.title`))
      )
      .join('|')
    this.dialog = page
      .getByRole('dialog')
      .filter({ hasText: new RegExp(titles) })
  }
}
