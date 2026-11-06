import type { Download, Page, Locator } from '@playwright/test'

import { DrivePage } from './DrivePage'
import type { FileRow } from './FileRow'
import { PublicMoveToPage } from './PublicMoveToPage'
import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

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
  private readonly drive: DrivePage

  constructor(page: Page) {
    this.page = page
    this.drive = new DrivePage(page)
  }

  /** The password prompt's input — stack-rendered, no testid we own. */
  get passwordInput(): Locator {
    return this.page.locator('input[type="password"]').first()
  }

  get passwordError(): Locator {
    return this.page.getByText('Invalid password')
  }

  /** The Drive public folder view's file list once access is granted. */
  get fileList(): Locator {
    return this.page.getByTestId('fil-content-body')
  }

  /** Shown when the link is expired or revoked (Error.public_unshared_title). */
  get unavailableMessage(): Locator {
    return this.page.getByRole('heading', { name: /no longer available/i })
  }

  /** Write actions stay hidden until the link's own permissions are
   * fetched, so a check for their absence has to wait for them. */
  async open(url: string): Promise<void> {
    const permissions = this.page.waitForResponse(
      response =>
        new URL(response.url()).pathname === '/permissions/self' &&
        response.ok()
    )
    await this.page.goto(url)
    await permissions
  }

  /** Create and Upload, offered only by an editable link. */
  get addButtons(): Locator {
    const labels = ['toolbar.menu_create', 'upload.label']
      .map(key => escapeRegExp(t(key)))
      .join('|')
    return this.page.getByRole('button', {
      name: new RegExp(`^(${labels})$`, 'i')
    })
  }

  async rowMenuItems(name: string): Promise<string[]> {
    const menu = await this.row(name).openMenu()
    const items = await menu.getByRole('menuitem').allInnerTexts()
    await this.page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    return items
  }

  row(name: string): FileRow {
    return this.drive.row(name)
  }

  async openFolder(name: string): Promise<void> {
    await this.drive.openFolder(name)
  }

  async downloadFolder(): Promise<Download> {
    const download = this.page.waitForEvent('download')
    await this.page.getByTestId('more-menu').getByRole('button').click()
    await this.page.getByRole('menuitem', { name: 'Download' }).click()
    return await download
  }

  async expectFileContent(content: string): Promise<void> {
    await expect(this.page.getByText(content, { exact: true })).toBeVisible()
  }

  async openMoveTo(name: string): Promise<PublicMoveToPage> {
    const menu = await this.row(name).openMenu()
    await menu.getByRole('menuitem', { name: /move to/i }).click()
    const moveTo = new PublicMoveToPage(this.page)
    await moveTo.waitForOpen()
    return moveTo
  }

  /** Fill the stack-served password prompt and submit it. */
  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.waitFor({ state: 'visible' })
    await this.passwordInput.fill(password)
    await this.passwordInput.press('Enter')
  }
}
