import type { Page, Locator } from '@playwright/test'

/**
 * A public share link opened in a fresh, unauthenticated browser context.
 *
 * A password-protected link is gated by a stack-served password page before
 * the Drive public route loads; an expired link is rejected outright. The
 * exact markup of those stack pages is not in the app source, so the selectors
 * here are intentionally broad (input type, role) and are pinned by the live
 * suite rather than by a testid we control.
 */
export class PublicLinkPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** The password prompt's input — stack-rendered, no testid we own. */
  get passwordInput(): Locator {
    return this.page.locator('input[type="password"]').first()
  }

  /** The Drive public folder view's file list once access is granted. */
  get fileList(): Locator {
    return this.page.getByTestId('fil-content-body')
  }

  /** Shown when the link is expired or revoked (Error.public_unshared_title). */
  get unavailableMessage(): Locator {
    return this.page.getByRole('heading', { name: /no longer available/i })
  }

  /** Fill the stack-served password prompt and submit it. */
  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.waitFor({ state: 'visible' })
    await this.passwordInput.fill(password)
    await this.passwordInput.press('Enter')
  }
}
