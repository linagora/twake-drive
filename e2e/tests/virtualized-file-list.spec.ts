import type { Route } from '@playwright/test'

import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  makeFilesToken,
  trashById
} from '../helpers/stack'

test('does not treat an offscreen later-page file as absent', async ({
  alicePage,
  aliceDrive
}) => {
  const folderId: string = await createFolder({
    instance: USERS.alice.instance,
    name: `Virtualized absence ${stamp()}`
  })
  const names: string[] = Array.from(
    { length: 101 },
    (_, index) => `file-${String(index).padStart(3, '0')}.txt`
  )
  const fileIds: string[] = []

  try {
    const token: string = makeFilesToken(USERS.alice.instance)
    for (const name of names) {
      fileIds.push(
        await createFile({
          instance: USERS.alice.instance,
          parentId: folderId,
          name,
          content: name,
          token
        })
      )
    }
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${folderId}`)
    await aliceDrive.row(names[100]).waitVisible()
    await expect(aliceDrive.row(names[0]).cell).toHaveCount(0)

    // Pagination must finish before the helper can conclude that a file is absent.
    await alicePage.route(
      '**/files/_find',
      async route => {
        await new Promise<void>(resolve => setTimeout(resolve, 300))
        await route.continue()
      },
      { times: 1 }
    )
    await expect(
      aliceDrive.row(names[0]).waitHidden({ timeout: 5_000 })
    ).rejects.toThrow('Expected file "file-000.txt" to be absent')
    await expect(aliceDrive.row(names[100]).cell).toBeVisible()

    await trashById(USERS.alice.instance, fileIds[0])
    await alicePage.reload()
    await aliceDrive.row(names[100]).waitVisible()
    await aliceDrive.row(names[0]).waitHidden()
    await expect(aliceDrive.row(names[100]).cell).toBeVisible()
  } finally {
    await trashById(USERS.alice.instance, folderId)
  }
})

test('waits for pagination started before the absence check', async ({
  alicePage,
  aliceDrive
}) => {
  const folderId: string = await createFolder({
    instance: USERS.alice.instance,
    name: `Pending pagination ${stamp()}`
  })
  const names: string[] = Array.from(
    { length: 101 },
    (_, index) => `file-${String(index).padStart(3, '0')}.txt`
  )
  const pendingRoutes: Route[] = []

  try {
    const token: string = makeFilesToken(USERS.alice.instance)
    for (const name of names) {
      await createFile({
        instance: USERS.alice.instance,
        parentId: folderId,
        name,
        content: name,
        token
      })
    }
    await alicePage.route('**/files/_find', async route => {
      const query: unknown = route.request().postDataJSON()
      if (
        typeof query === 'object' &&
        query !== null &&
        'bookmark' in query &&
        typeof query.bookmark === 'string'
      ) {
        pendingRoutes.push(route)
      } else await route.continue()
    })
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${folderId}`)
    // Date sorting puts the first-created file on the second page.
    await aliceDrive.row(names[1]).waitVisible()
    await expect.poll(() => pendingRoutes.length).toBe(1)

    const releasePagination = async (): Promise<void> => {
      await new Promise<void>(resolve => setTimeout(resolve, 2_000))
      const route: Route | null = pendingRoutes.shift() ?? null
      if (!route) throw new Error('Pagination did not start')
      await route.continue()
    }
    await Promise.all([
      expect(
        aliceDrive.row(names[0]).waitHidden({ timeout: 5_000 })
      ).rejects.toThrow('Expected file "file-000.txt" to be absent'),
      releasePagination()
    ])
    await aliceDrive.row(names[0]).waitVisible()
  } finally {
    for (const route of pendingRoutes) await route.continue()
    await alicePage.unroute('**/files/_find')
    await trashById(USERS.alice.instance, folderId)
  }
})
