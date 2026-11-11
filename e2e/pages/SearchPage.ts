import type { Locator, Page } from '@playwright/test'

import { escapeRegExp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

/** The search view of Drive (`#/search`) and its suggestions. */
export class SearchPage {
  constructor(private readonly page: Page) {}

  async open(appUrl: string): Promise<void> {
    await this.page.goto(`${appUrl}/#/search`)
  }

  async search(term: string): Promise<void> {
    const input = this.page
      .getByRole('textbox', { name: t('searchbar.placeholder') })
      .first()
    await input.waitFor({ state: 'visible' })
    await input.fill(term)
  }

  /** A suggestion, found by its name: the path shown under it may hold the
   * name of another suggestion. */
  suggestion(name: string): Locator {
    return this.page
      .getByRole('button')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}`) })
  }

  /** Opens a suggestion through its icon: the path under its name is a link
   * of its own. */
  async openSuggestion(name: string): Promise<void> {
    const suggestion = this.suggestion(name)
    await suggestion.waitFor({ state: 'visible', timeout: 15_000 })
    await suggestion.locator('svg').first().click()
  }
}
