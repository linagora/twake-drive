import type { Page, Locator } from '@playwright/test'

/** Sidebar / global navigation helpers. Routes that don't have a sidebar
 * entry (Favorites, Search) fall back to a hash-based goto on the current
 * origin so tests don't have to special-case them. */
export class SidebarPage {
  private readonly page: Page
  private readonly nav: Locator

  constructor(page: Page) {
    this.page = page
    this.nav = page.locator('nav')
  }

  private async goToHash(hash: string): Promise<void> {
    const url = new URL(this.page.url())
    url.hash = hash
    await this.page.goto(url.toString())
  }

  async goToRecent(): Promise<void> {
    await this.nav.getByRole('link', { name: /recents?/i }).first().click()
  }

  async goToFavorites(): Promise<void> {
    await this.goToHash('#/favorites')
  }

  async goToTrash(): Promise<void> {
    await this.nav.getByRole('link', { name: /(bin|trash)/i }).first().click()
  }
}
