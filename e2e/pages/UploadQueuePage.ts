import type { Page, Locator } from '@playwright/test'

import { escapeRegExp } from '../helpers/fixtures'

export class UploadQueuePage {
  private readonly page: Page
  private readonly queue: Locator

  constructor(page: Page) {
    this.page = page
    this.queue = page.getByTestId('upload-queue')
  }

  async waitForOpen(): Promise<void> {
    await this.queue.waitFor({ state: 'visible', timeout: 15_000 })
  }

  getItemByName(name: string): Locator {
    return this.queue
      .getByTestId('upload-queue-item-name')
      .filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) })
  }

  async waitForItem(name: string): Promise<void> {
    await this.getItemByName(name).waitFor({ state: 'visible', timeout: 15_000 })
  }
}
