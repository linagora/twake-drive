import type { Page } from '@playwright/test'

export class FileViewerPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** The viewer route always contains `/file/<id>` in the URL fragment. */
  async waitForOpen(): Promise<void> {
    await this.page.waitForURL(/\/file\/[^/]+/, { timeout: 10_000 })
  }

  /** Closes the viewer by navigating back, then waits for the file route to drop. */
  async close(): Promise<void> {
    await this.page.goBack()
    await this.page.waitForURL(url => !/\/file\/[^/]+/.test(url.toString()), {
      timeout: 5_000
    })
  }
}
