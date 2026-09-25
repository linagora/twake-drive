import type { FrameLocator, Page } from '@playwright/test'

import { expect } from '../helpers/fixtures'

export class OnlyOfficePdfPage {
  private readonly frame: FrameLocator

  constructor(private readonly page: Page) {
    this.frame = page.frameLocator('iframe[name="frameEditor"]')
  }

  async waitForOpen(fileId: string): Promise<void> {
    await this.page.waitForURL(url =>
      url.hash.includes(`/onlyoffice/${fileId}`)
    )
    await expect(
      this.frame.getByRole('button', { name: /Edit PDF/ })
    ).toBeVisible()
    const guestNamePrompt = this.frame.getByText(
      'Enter a name to be used for collaboration'
    )
    if (await guestNamePrompt.isVisible()) {
      await this.frame.getByRole('textbox').last().fill('E2E Alice')
      await this.frame.getByRole('button', { name: 'OK' }).click()
    }
  }

  async insertText(marker: string): Promise<void> {
    await this.frame.getByRole('button', { name: /Edit PDF/ }).click()
    await this.dismissTip()
    await this.frame.getByRole('tab', { name: 'Insert' }).click()
    await this.dismissTip()
    await this.frame.getByRole('button', { name: 'Text Box' }).click()
    await this.dismissTip()
    if (!(await this.frame.getByRole('menu').isVisible())) {
      await this.frame.getByRole('button', { name: 'Text Box' }).click()
    }
    await this.frame
      .getByRole('menu')
      .getByText('Insert horizontal text box')
      .click()
    await this.frame.locator('canvas#id_forms').click({
      position: { x: 400, y: 200 }
    })
    for (const character of marker) {
      await this.page.keyboard.press(character)
    }
    await expect(
      this.frame.getByRole('button', { name: /Save \(Ctrl\+S\)/ })
    ).toBeEnabled()
  }

  async save(): Promise<void> {
    const save = this.frame.getByRole('button', { name: /Save \(Ctrl\+S\)/ })
    await save.click()
    await expect(save).toBeDisabled()
  }

  async close(): Promise<void> {
    await this.page.goBack()
    await expect(this.page.locator('iframe[name="frameEditor"]')).toHaveCount(0)
  }

  async expectTextVisible(marker: string): Promise<void> {
    await this.frame.getByRole('button', { name: /Find \(Ctrl\+F\)/ }).click()
    await this.frame.getByRole('searchbox', { name: 'Find' }).fill(marker)
    await expect(this.frame.getByText('1/1', { exact: true })).toBeVisible()
  }

  private async dismissTip(): Promise<void> {
    const tip = this.frame.locator('.synch-tip-root')
    if (await tip.isVisible()) {
      await tip.getByText('Got it', { exact: true }).click()
      await expect(tip).toBeHidden()
    }
  }
}
