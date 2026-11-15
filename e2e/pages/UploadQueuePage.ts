import { expect } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'

import { escapeRegExp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

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

  getRow(name: string): Locator {
    return this.queue
      .getByTestId('upload-queue-item')
      .filter({
        has: this.page
          .getByTestId('upload-queue-item-name')
          .filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) })
      })
  }

  /** `key` is one of the UploadQueue.item labels: paused, offline, gone. */
  getStatusLabel(name: string, key: string): Locator {
    return this.getRow(name).getByText(t(`UploadQueue.item.${key}`))
  }

  /** Waits until the progress bar of the row is past `percent`. */
  async waitForProgress(name: string, percent: number): Promise<void> {
    const bar = this.getRow(name).getByRole('progressbar')
    await expect
      .poll(async () => Number(await bar.getAttribute('aria-valuenow')))
      .toBeGreaterThan(percent)
  }

  async pause(name: string): Promise<void> {
    await this.getRow(name)
      .getByRole('button', { name: t('UploadQueue.item.pause') })
      .click()
  }

  async resume(name: string): Promise<void> {
    await this.getRow(name)
      .getByRole('button', { name: t('UploadQueue.item.resume') })
      .click()
  }
}
