import type { Page } from '@playwright/test'

import { MoveToPage } from './MoveToPage'
import { expect } from '../helpers/fixtures'

export class FileViewerPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** The viewer route always contains `/file/<id>` in the URL fragment. */
  async waitForOpen(): Promise<void> {
    await this.page.waitForURL(/\/file\/[^/]+/, { timeout: 10_000 })
  }

  async expectFileName(name: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name })).toBeVisible()
  }

  async expectVisible(): Promise<void> {
    await expect(this.page.getByTestId('viewer-toolbar')).toBeVisible()
  }

  async expectWhoHasAccessWith(members: (string | RegExp)[]): Promise<void> {
    await expect(
      this.page.getByText('Who has access?', { exact: true })
    ).toBeVisible()

    for (const member of members) {
      await expect(this.page.getByText(member).first()).toBeVisible()
    }
  }

  async openMoveTo(): Promise<MoveToPage> {
    const toolbar = this.page.getByTestId('viewer-toolbar')
    await toolbar
      .getByRole('button')
      .filter({ hasNotText: /\S/ })
      .last()
      .click()
    await this.page
      .getByRole('menu')
      .getByRole('menuitem', { name: /move to/i })
      .click()

    const moveTo = new MoveToPage(this.page)
    await moveTo.waitForOpen()
    return moveTo
  }

  /** Closes the viewer by navigating back, then waits for the file route to drop. */
  async close(): Promise<void> {
    await this.page.goBack()
    await this.page.waitForURL(url => !/\/file\/[^/]+/.test(url.toString()), {
      timeout: 5_000
    })
  }
}
