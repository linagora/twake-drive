import type { Page, Locator } from '@playwright/test'

import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

// The banner sentence, its %{owner} matching anyone and its %{name} captured
const BANNER_TEXT = new RegExp(
  escapeRegExp(t('SharingInvitations.text'))
    .replace(escapeRegExp('%{owner}'), '.*')
    .replace(escapeRegExp('%{name}'), '(.*)')
)

/** The "<owner> shared “<name>” with you" banner above the file list. It
 * shows one invitation at a time, the oldest first. */
export class InvitationBannerPage {
  private readonly banner: Locator

  constructor(page: Page) {
    this.banner = page.getByTestId('sharing-invitations').getByRole('alert')
  }

  /** The shared name in the banner, '' when there is none. MidEllipsis puts
   * invisible U+200E marks in the name. */
  async sharedName(opts?: { timeout?: number }): Promise<string> {
    const shown = await this.banner
      .waitFor({ state: 'visible', timeout: opts?.timeout ?? 5_000 })
      .then(() => true)
      .catch((err: Error) => {
        if (err.name === 'TimeoutError') return false
        throw err
      })
    if (!shown) return ''
    const text = (await this.banner.textContent()) ?? ''
    return text.replace(/\u200e/g, '').match(BANNER_TEXT)?.[1] ?? ''
  }

  async accept(): Promise<void> {
    await this.act('accept')
  }

  async decline(): Promise<void> {
    await this.act('decline')
  }

  async close(): Promise<void> {
    await this.act('close')
  }

  /** Waits for the banner to move on to the next invitation, or to go. */
  private async act(action: 'accept' | 'decline' | 'close'): Promise<void> {
    const before = await this.banner.textContent()
    await this.banner
      .getByRole('button', { name: t(`SharingInvitations.${action}`) })
      .click()
    await expect(this.banner.filter({ hasText: before ?? '' })).toHaveCount(0)
  }
}
