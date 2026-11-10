import type { Page } from '@playwright/test'

import { MoveToPage } from './MoveToPage'
import { ShareModalPage } from './ShareModalPage'
import { escapeRegExp, expect } from '../helpers/fixtures'
import { t } from '../helpers/i18n'

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

  async expectViewerToolbarVisible(): Promise<void> {
    await expect(this.page.getByTestId('viewer-toolbar')).toBeVisible()
  }

  async expectWhoHasAccessWith(members: (string | RegExp)[]): Promise<void> {
    await expect(
      this.page.getByText(t('cozy-viewer:Viewer.panel.sharing'), {
        exact: true
      })
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
      .getByRole('menuitem', {
        name: t('SelectionBar.moveto')
      })
      .click()

    const moveTo = new MoveToPage(this.page)
    await moveTo.waitForOpen()
    return moveTo
  }

  /** new-file-viewer-ui is off in the e2e stack, so the viewer's Share entry
   * lives in the actions (dots) menu. That trigger is icon-only; the Download
   * button carries a text label, so restricting to text-less buttons keeps the
   * target stable if cozy-viewer appends a labelled toolbar button. The
   * returned modal is not awaited, so a caller can assert the route first. */
  async openShareFromMenu(): Promise<ShareModalPage> {
    await this.page
      .getByTestId('viewer-toolbar')
      .getByRole('button')
      .filter({ hasNotText: /\S/ })
      .last()
      .click()
    await this.page
      .getByRole('menu')
      .getByRole('menuitem', {
        name: new RegExp(`^${escapeRegExp(t('Files.share.cta'))}$`, 'i')
      })
      .click()
    return new ShareModalPage(this.page)
  }

  /** Closes the viewer by navigating back, then waits for the file route to drop. */
  async close(): Promise<void> {
    await this.page.goBack()
    await this.page.waitForURL(url => !/\/file\/[^/]+/.test(url.toString()), {
      timeout: 5_000
    })
  }
}
