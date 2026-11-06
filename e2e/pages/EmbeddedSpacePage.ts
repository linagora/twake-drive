import type { Page, Locator } from '@playwright/test'

import type { User } from '../helpers/config'
import { escapeRegExp } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

/** One shared drive as TwakeSpace embeds it, on `#/embed/sharings/<driveId>`. */
export class EmbeddedSpacePage {
  constructor(
    private readonly page: Page,
    private readonly user: User,
    private readonly driveId: string
  ) {}

  /** Matches every route of the space, root redirect included. */
  get routePattern(): RegExp {
    return new RegExp(`#/embed/sharings/${escapeRegExp(this.driveId)}/`)
  }

  get breadcrumb(): Locator {
    return this.page.getByRole('main').getByRole('navigation')
  }

  /** The Drive chrome the space must not show: top bar, sidebar, banners. */
  get chrome(): Locator {
    return this.page
      .getByRole('banner')
      .or(this.page.getByRole('complementary'))
      .or(this.page.getByRole('alert'))
  }

  get notFound(): Locator {
    return this.page.getByText(t('NotFound.title'))
  }

  /** Waits for the redirect to the drive's root folder. */
  async open(): Promise<void> {
    await this.page.goto(`${this.user.appUrl}/#/embed/sharings/${this.driveId}`)
    await this.page.waitForURL(new RegExp(`${this.routePattern.source}[^/]+$`))
  }

  async goUpTo(name: string): Promise<void> {
    await this.breadcrumb.getByText(name, { exact: true }).click()
  }
}
