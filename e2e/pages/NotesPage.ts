import type { Page } from '@playwright/test'

import type { User } from '../helpers/config'
import { escapeRegExp, expect } from '../helpers/fixtures'

/**
 * The Notes app a note is handed to. A note of someone else's shared drive
 * opens in the Notes app of its owner, through the shared-drive notes route
 * (`/sharings/drives/<driveId>/notes/<noteId>/open`) on the reader's stack.
 */
export class NotesPage {
  constructor(private readonly page: Page) {}

  /** Run `open` and assert it lands on the Notes app of `owner` for `noteId`,
   * instead of the Drive viewer. */
  async expectOpenedOn(
    owner: User,
    noteId: string,
    open: () => Promise<void>
  ): Promise<void> {
    const openResponse = this.page.waitForResponse(
      response =>
        response.url().includes(`/notes/${noteId}/open`) &&
        response.url().includes('/sharings/drives/'),
      { timeout: 30_000 }
    )

    await open()

    const response = await openResponse
    expect(response.ok()).toBe(true)

    const ownerNotesHost = owner.appUrl.replace(/-drive\./, '-notes.')
    await expect(this.page).toHaveURL(
      new RegExp(`^${escapeRegExp(ownerNotesHost)}/.*${escapeRegExp(noteId)}`),
      { timeout: 30_000 }
    )
  }
}
