import type { FrameLocator, Locator, Page } from '@playwright/test'

import { USERS } from '../helpers/config'

export type LinkAccessLevel = 'Viewer' | 'Editor'

/**
 * Page object for the File Picker intent dialog.
 *
 * The FilePicker is opened through the sidebar "Pick a file" button
 * (behind the `drive.file-picker-demo.enabled` flag) and rendered inside
 * an iframe.  Once the user confirms a file/folder with a link mode,
 * the result is displayed in a confirmation dialog back in the parent
 * page.
 */
export class FilePickerPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Navigate to Drive and open the file picker dialog. */
  async open(configName?: string): Promise<void> {
    await this.page.goto(`${USERS.alice.appUrl}/#/folder`)
    await this.page.getByRole('button', { name: /pick a file/i }).waitFor({
      state: 'visible'
    })
    if (configName) {
      await this.page.getByRole('radio', { name: configName }).check()
    }
    await this.page.getByRole('button', { name: /pick a file/i }).click()
    // The picker is loaded inside an iframe inside a MUI/Dialog — wait for it.
    await this.waitForPicker()
  }

  /** Wait until the picker iframe is present and loaded. */
  async waitForPicker(): Promise<void> {
    const frameLocator = this.getFrameLocator()
    await frameLocator
      .getByTestId('file-picker-header')
      .waitFor({ state: 'visible' })
  }

  /** Whether the picker iframe is currently visible (picker is open). */
  async isOpen(): Promise<boolean> {
    const frame = this.page.locator('iframe[src*="intents"]')
    return frame.isVisible()
  }

  /** Wait for the picker dialog to close (e.g. after a link is generated). */
  async waitForClosed(): Promise<void> {
    // The parent dialog / iframe is removed after completion.
    await this.page
      .locator('iframe')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {})
  }

  /**
   * Double-click a folder row to navigate inside it.
   * Waits for the breadcrumb to reflect the new folder before returning.
   */
  async navigateToFolder(name: string): Promise<void> {
    const frame = this.getFrameLocator()
    const folderRow = this.getListItemByName(name)
    await folderRow.getByTestId('listitem-onclick').dblclick()
    await frame
      .getByTestId('file-picker-breadcrumb')
      .getByText(name, { exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 })
  }

  // ---------------------------------------------------------------------------
  // Selection (single mode — radio buttons)
  // ---------------------------------------------------------------------------

  /**
   * Select a file or folder by clicking its radio / checkbox area.
   * The item must be currently visible in the list.
   */
  async selectItem(name: string): Promise<void> {
    const listItem = this.getListItemByName(name)
    // Click the choice area (radio/checkbox wrapper).
    await listItem.getByTestId('choice-onclick').click()
  }

  /**
   * Ctrl-click a choice area to toggle it without clearing existing selection.
   * Works only in multiple mode (checkboxes).
   */
  async toggleItem(name: string): Promise<void> {
    const listItem = this.getListItemByName(name)
    const isMac = process.platform === 'darwin'
    await listItem
      .getByTestId('choice-onclick')
      .click({ modifiers: [isMac ? 'Meta' : 'Control'] })
  }

  /** Open the link access dialog from the "Public link" footer button. */
  async openPublicLinkAccess(): Promise<void> {
    const frame = this.getFrameLocator()
    await frame.getByTestId('public-link-btn').click()
    await this.getLinkAccessDialog().waitFor({ state: 'visible' })
  }

  /** Select the access level used by the generated public links. */
  async setLinkAccess(level: LinkAccessLevel): Promise<void> {
    const frame = this.getFrameLocator()
    await this.getLinkAccessDialog()
      .getByRole('button', { name: 'Access level' })
      .click()
    await frame.getByRole('menuitem', { name: level, exact: true }).click()
  }

  /** Confirm the current access settings and generate the public links. */
  async confirmPublicLinks(): Promise<void> {
    await this.getLinkAccessDialog()
      .getByRole('button', { name: 'Add links' })
      .click()
  }

  /** Open the access dialog and generate public links with default settings. */
  async createPublicLinks(): Promise<void> {
    await this.openPublicLinkAccess()
    await this.confirmPublicLinks()
  }

  /** Whether the link access dialog is currently visible. */
  async isLinkAccessOpen(): Promise<boolean> {
    return this.getLinkAccessDialog().isVisible()
  }

  /** Whether a selected document is listed in the link access dialog. */
  async hasLinkAccessDocument(name: string): Promise<boolean> {
    return this.getLinkAccessDialog()
      .getByText(name, { exact: true })
      .isVisible()
  }

  /** Click the reference action in the picker footer. */
  async clickReference(): Promise<void> {
    await this.getFrameLocator().getByTestId('reference-btn').click()
  }

  /** Whether the reference action is disabled. */
  async isReferenceDisabled(): Promise<boolean> {
    return this.getFrameLocator().getByTestId('reference-btn').isDisabled()
  }

  /** Whether the reference action is visible. */
  async hasReferenceButton(): Promise<boolean> {
    return this.getFrameLocator().getByTestId('reference-btn').isVisible()
  }

  /** Click the "Temporary download link" button in the picker footer. */
  async clickTemporaryDownloadLink(): Promise<void> {
    const frame = this.getFrameLocator()
    await frame.getByTestId('temporary-download-link-btn').click()
  }

  /** Whether the "Temporary download link" button is currently disabled. */
  async isTemporaryDownloadDisabled(): Promise<boolean> {
    const frame = this.getFrameLocator()
    return frame.getByTestId('temporary-download-link-btn').isDisabled()
  }

  /** Whether the "Temporary download link" button is visible. */
  async hasTemporaryDownloadButton(): Promise<boolean> {
    const frame = this.getFrameLocator()
    return frame.getByTestId('temporary-download-link-btn').isVisible()
  }

  /** Whether the "Public link" button is currently disabled. */
  async isPublicLinkDisabled(): Promise<boolean> {
    const frame = this.getFrameLocator()
    return frame.getByTestId('public-link-btn').isDisabled()
  }

  /** Whether the "Public link" button is visible. */
  async hasPublicLinkButton(): Promise<boolean> {
    const frame = this.getFrameLocator()
    return frame.getByTestId('public-link-btn').isVisible()
  }

  // ---------------------------------------------------------------------------
  // Confirmation dialog (parent page, after picker closes)
  // ---------------------------------------------------------------------------

  /** Get the generated sharing / download link from the confirmation dialog. */
  async getConfirmationLink(): Promise<string> {
    // After completion the FilePickerButton shows a ConfirmDialog with the link.
    const dialog = this.page.getByRole('dialog')
    const link = dialog.locator('a').first()
    await link.waitFor({ state: 'visible' })
    return (await link.getAttribute('href')) ?? ''
  }

  /** Read the raw File Picker document displayed in the confirmation dialog. */
  async getResultDocument(): Promise<unknown> {
    const dialog = this.page.getByRole('dialog')
    const result = dialog.getByTestId('file-picker-result')
    await result.waitFor({ state: 'visible' })
    return JSON.parse((await result.textContent()) ?? 'null')
  }

  /** Close the post-pick confirmation dialog. */
  async closeConfirmation(): Promise<void> {
    const dialog = this.page.getByRole('dialog')
    // The ConfirmDialog renders a "Close" text button (not the X icon button
    // which also has aria-label "Close"). Use getByText to avoid strict-mode
    // violation from the two matching buttons.
    await dialog.getByText('Close').click()
    await dialog.waitFor({ state: 'hidden' })
  }

  // ---------------------------------------------------------------------------
  // Error display (inside the picker iframe)
  // ---------------------------------------------------------------------------

  /** Whether the inline error alert is visible inside the picker. */
  async isErrorVisible(): Promise<boolean> {
    const frame = this.getFrameLocator()
    return frame.getByTestId('file-picker-error').isVisible()
  }

  /** Get the error text displayed inside the picker. */
  async getErrorText(): Promise<string> {
    const frame = this.getFrameLocator()
    const alert = frame.getByTestId('file-picker-error')
    await alert.waitFor({ state: 'visible' })
    return (await alert.textContent()) ?? ''
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Return a FrameLocator for the picker iframe.
   *
   * The IntentDialogOpener renders the intent service inside an iframe.
   * We locate the iframe that points to the intents endpoint.
   */
  private getFrameLocator(): FrameLocator {
    return this.page.frameLocator('iframe[src*="intents"]')
  }

  /** Return the public-link access dialog displayed inside the picker. */
  private getLinkAccessDialog(): Locator {
    const frame = this.getFrameLocator()
    return frame
      .getByRole('dialog')
      .filter({ has: frame.getByText('Set link access', { exact: true }) })
  }

  /** Find an item by its untruncated, clean DOM title. */
  private getListItemByName(name: string): Locator {
    const frame = this.getFrameLocator()
    return frame
      .getByTestId('list-item')
      .filter({ has: frame.getByTitle(name, { exact: true }) })
  }
}
