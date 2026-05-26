import type { Page, Locator } from '@playwright/test'

export class SharedDrivePage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  getCreateButton(): Locator {
    // The CreateSharedDriveButton renders inside the empty-folder container.
    // Scoping avoids matching the sidebar "Create" button.
    return this.page
      .getByTestId('empty-folder')
      .getByRole('button', { name: /create/i })
  }

  async clickCreate(): Promise<void> {
    await this.getCreateButton().click()
  }
}
