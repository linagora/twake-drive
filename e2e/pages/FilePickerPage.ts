import type { FrameLocator, Page } from '@playwright/test'

import { USERS } from '../helpers/config'

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

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Navigate to Drive and open the file picker dialog. */
  async open(configName?: string): Promise<void> {
    await this.page.goto(`${USERS.alice.appUrl}/#/folder`)
    // Wait for the sidebar to be rendered before clicking the button.
    await this.page.getByRole('button', { name: /pick a file/i }).waitFor({
      state: 'visible'
    })
    if (configName) {
      await this.selectConfig(configName)
    }
    await this.page.getByRole('button', { name: /pick a file/i }).click()
    // The picker is loaded inside an iframe inside a MUI/Dialog — wait for it.
    await this.waitForPicker()
  }

  /** Select one of the demo configurations exposed above the opener button. */
  async selectConfig(name: string): Promise<void> {
    await this.page.getByRole('radio', { name }).check()
  }

  /** Wait until the picker iframe is present and loaded. */
  async waitForPicker(): Promise<void> {
    const frameLocator = this.getFrameLocator()
    // The FilePickerHeader renders a breadcrumb <h4> once the folder query resolves.
    await frameLocator.locator('h4').first().waitFor({ state: 'visible' })
  }

  /** Wait for the picker dialog to close (e.g. after a link is generated). */
  async waitForClosed(): Promise<void> {
    // The parent dialog / iframe is removed after completion.
    await this.page
      .locator('iframe')
      .waitFor({ state: 'detached' })
      .catch(() => {
        // Dialog may close without an iframe re-render — tolerate.
      })
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Double-click a folder row to navigate inside it.
   * Waits for the breadcrumb to reflect the new folder before returning.
   */
  async navigateToFolder(name: string): Promise<void> {
    const frame = this.getFrameLocator()
    const folderRow = frame.getByTestId('list-item').filter({ hasText: name })
    await folderRow.getByTestId('listitem-onclick').dblclick()
    // Wait for the breadcrumb heading to update with the folder name.
    await frame.locator('h4', { hasText: name }).waitFor({
      state: 'visible',
      timeout: 10_000
    })
  }

  /**
   * Click a breadcrumb segment to navigate up the folder tree.
   * On desktop every segment except the last is clickable.
   */
  async navigateViaBreadcrumb(name: string): Promise<void> {
    const frame = this.getFrameLocator()
    // Breadcrumb is rendered as <span> elements inside an <h4>.
    // CSS modules hash class names, so locate by element + text content.
    await frame.locator('h4 span', { hasText: name }).first().click()
  }

  // ---------------------------------------------------------------------------
  // Selection (single mode — radio buttons)
  // ---------------------------------------------------------------------------

  /**
   * Select a file or folder by clicking its radio / checkbox area.
   * The item must be currently visible in the list.
   */
  async selectItem(name: string): Promise<void> {
    const frame = this.getFrameLocator()
    const listItem = frame.getByTestId('list-item').filter({ hasText: name })
    // Click the choice area (radio/checkbox wrapper).
    await listItem.getByTestId('choice-onclick').click()
  }

  // ---------------------------------------------------------------------------
  // Footer actions
  // ---------------------------------------------------------------------------

  /** Click the "Public link" button in the picker footer. */
  async clickPublicLink(): Promise<void> {
    const frame = this.getFrameLocator()
    await frame.getByTestId('public-link-btn').click()
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
    return (await frame.getByTestId('temporary-download-link-btn').count()) > 0
  }

  /** Whether the "Public link" button is currently disabled. */
  async isPublicLinkDisabled(): Promise<boolean> {
    const frame = this.getFrameLocator()
    return frame.getByTestId('public-link-btn').isDisabled()
  }

  /** Whether the "Public link" button is visible. */
  async hasPublicLinkButton(): Promise<boolean> {
    const frame = this.getFrameLocator()
    return (await frame.getByTestId('public-link-btn').count()) > 0
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
}
