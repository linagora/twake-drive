import type { Locator } from '@playwright/test'

import { expect } from '../helpers/fixtures'

export async function expectFolderBeforeFile(
  folder: Locator,
  file: Locator
): Promise<void> {
  await expect(folder).toBeVisible()
  await expect(file).toBeVisible()
  await expect(file).toHaveAttribute('aria-disabled', 'true')
  const fileId = await file.getAttribute('data-file-id')
  if (!fileId) throw new Error('File row has no ID')
  await expect
    .poll(() =>
      folder.evaluate((row, id) => {
        const fileRow = Array.from(
          row.parentElement?.querySelectorAll('[data-testid="list-item"]') ?? []
        ).find(candidate => candidate.getAttribute('data-file-id') === id)
        return Boolean(
          fileRow &&
          row.compareDocumentPosition(fileRow) &
            Node.DOCUMENT_POSITION_FOLLOWING
        )
      }, fileId)
    )
    .toBe(true)
}
