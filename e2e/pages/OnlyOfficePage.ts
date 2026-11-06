import type { FrameLocator, Page } from '@playwright/test'

import type { FileRow } from './FileRow'
import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

export class OnlyOfficePage {
  constructor(private readonly page: Page) {}

  async openFromRow(row: FileRow, fileId: string): Promise<void> {
    const configResponse = this.page.waitForResponse(
      response => response.url().includes(`/office/${fileId}/open`),
      { timeout: 60_000 }
    )

    await row.open()
    await expect(this.page).toHaveURL(
      new RegExp(`/onlyoffice/${escapeRegExp(fileId)}`)
    )

    const response = await configResponse
    expect(response.ok()).toBe(true)
    const body = (await response.json()) as {
      data: { attributes: { onlyoffice: { documentType: string } } }
    }
    expect(body.data.attributes.onlyoffice.documentType).toBe('word')

    await expect(this.page.getByTestId('onlyoffice-title')).toBeVisible()
    await expect(this.page.locator('iframe[name="frameEditor"]')).toBeVisible({
      timeout: 90_000
    })
    await expect(
      this.page
        .frameLocator('iframe[name="frameEditor"]')
        .getByText('Page 1 of 1')
    ).toBeVisible({ timeout: 90_000 })
  }

  private get editor(): FrameLocator {
    return this.page.frameLocator('iframe[name="frameEditor"]')
  }

  /** Wait for a text document to load, and answer the name prompt the
   * editor shows once per browser for collaboration. */
  async waitForTextEditor(userName: string): Promise<void> {
    await expect(this.editor.getByText('Page 1 of 1')).toBeVisible({
      timeout: 90_000
    })
    const nameInput = this.editor.locator('#id-dlg-username-caption input')
    const asked = await nameInput
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch((err: Error) => {
        if (err.name === 'TimeoutError') return false
        throw err
      })
    if (!asked) return
    await nameInput.fill(userName)
    await nameInput.press('Enter')
    await expect(nameInput).toBeHidden()
  }

  /** "All changes saved" only means the Document Server has the edit: the
   * stack gets it through the save callback once the editor is closed. */
  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text, { delay: 30 })
    await expect(this.editor.getByText('All changes saved')).toBeVisible({
      timeout: 30_000
    })
  }

  async back(): Promise<void> {
    await this.page
      .getByRole('button', { name: t('button.back') })
      .first()
      .click()
    await this.page.waitForURL(/#\/folder\/[^/]+$/)
    // The Create menu opens again after a document created with it, see
    // linagora/twake-drive#4328
    const menu = this.page.getByRole('menu')
    const reopened = await menu
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch((err: Error) => {
        if (err.name === 'TimeoutError') return false
        throw err
      })
    if (!reopened) return
    await this.page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
  }
}
