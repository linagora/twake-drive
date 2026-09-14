import { copyFile } from 'fs/promises'
import path from 'path'

import type { Page } from '@playwright/test'

import { USERS } from '../helpers/config'
import { expect, safeUnlink, stamp, test } from '../helpers/fixtures'
import { trashByName } from '../helpers/stack'
import type { DrivePage } from '../pages/DrivePage'
import type { MoveToPage } from '../pages/MoveToPage'

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')
const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`

interface MoveScenario {
  destination: string
  destinationId: string
  entries: string[]
  entryIds: string[]
  sourcePaths: string[]
  moveTo: MoveToPage
}

async function createMoveScenario(
  alicePage: Page,
  aliceDrive: DrivePage
): Promise<MoveScenario> {
  const destination = 'Administrative'
  const entries = [
    `Move partial A ${stamp()}.txt`,
    `Move partial B ${stamp()}.txt`
  ]

  const sourcePaths = entries.map(entry =>
    path.join(path.dirname(FIXTURE), entry)
  )
  await Promise.all(
    sourcePaths.map(sourcePath => copyFile(FIXTURE, sourcePath))
  )
  await aliceDrive.uploadFiles(sourcePaths)
  for (const entry of entries) {
    await aliceDrive.row(entry).waitVisible()
  }
  const entryIds = await Promise.all(
    entries.map(entry => aliceDrive.row(entry).fileId())
  )
  await aliceDrive.selectRows(entries)
  const moveTo = await aliceDrive.openMoveToForSelection()
  const destinationId = await moveTo.folderId(destination)
  await moveTo.openFolder(destination)

  return {
    destination,
    destinationId,
    entries,
    entryIds,
    sourcePaths,
    moveTo
  }
}

async function cleanupMoveScenario(
  names: string[],
  sourcePaths: string[] = []
): Promise<void> {
  for (const name of names) {
    await trashByName(USERS.alice.instance, name)
  }
  const pathsToClean =
    sourcePaths.length > 0
      ? sourcePaths
      : names.map(name => path.join(path.dirname(FIXTURE), name))
  await Promise.all(pathsToClean.map(sourcePath => safeUnlink(sourcePath)))
}

test.describe('MoveTo folder creation', () => {
  test('creates a destination folder inline and moves the source into it', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const folderName = `0AA-${stamp()}`
    let createdFolder: string | null = null
    const sourceFile = `Move source ${stamp()}.txt`
    const sourcePath = path.join(path.dirname(FIXTURE), sourceFile)
    await copyFile(FIXTURE, sourcePath)

    try {
      await aliceDrive.uploadFiles(sourcePath)
      await aliceDrive.row(sourceFile).waitVisible()

      const moveTo = await aliceDrive.row(sourceFile).openMoveTo()
      await expect(moveTo.createFolderButton).toBeVisible()
      await moveTo.showFolderCreation()

      await moveTo.creationInput.fill(folderName)
      await moveTo.creationInput.press('Enter')

      await expect(moveTo.creationForm).toBeHidden()
      createdFolder = folderName
      await expect(moveTo.breadcrumb).toHaveText('My Drive')
      await expect(moveTo.isFolderSelected(folderName)).resolves.toBe(false)

      await moveTo.openFolder(folderName)
      await expect(moveTo.moveButton).toBeEnabled()
      await moveTo.confirm()

      await aliceDrive.row(sourceFile).waitHidden()
      await aliceDrive.row(folderName).open()
      await alicePage.waitForURL(/\/folder\/[^/]+$/)
      await expect(aliceDrive.row(sourceFile).cell).toBeVisible()
    } finally {
      await alicePage.goto(ALICE_ROOT)
      if (createdFolder) {
        await aliceDrive.row(createdFolder).sendToTrash()
      }
      await safeUnlink(sourcePath)
    }
  })

  test('keeps the source visible but prevents selecting it as destination', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)

    const moveTo = await aliceDrive.row('Administrative').openMoveTo()
    await moveTo.expectFolderDisabled('Administrative', /being moved/i)
    await moveTo.expectMoveDisabled()
    await moveTo.close()
  })
})

test.describe('MoveTo execution', () => {
  test('moves several entries completely', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const scenario = await createMoveScenario(alicePage, aliceDrive)

    try {
      await scenario.moveTo.confirm()

      for (const entry of scenario.entries) {
        await aliceDrive.row(entry).waitHidden()
      }
      await aliceDrive.openFolder(scenario.destination)
      for (const entry of scenario.entries) {
        await expect(aliceDrive.row(entry).cell).toBeVisible()
      }
    } finally {
      await cleanupMoveScenario(scenario.entries)
    }
  })

  test('retries only failed entries after a partial success', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const scenario = await createMoveScenario(alicePage, aliceDrive)

    try {
      await scenario.moveTo.failMoves([scenario.entryIds[1]], true)
      await scenario.moveTo.clickMove()
      await scenario.moveTo.expectPartialResult(1, 1)
      await scenario.moveTo.expectRemainingEntry(scenario.entries[1])
      await scenario.moveTo.expectDestinationLocked()

      await scenario.moveTo.clickMove()
      await expect(scenario.moveTo.dialogLocator).toBeHidden()
      expect(scenario.moveTo.moveRequestCount(scenario.entryIds[0])).toBe(1)
      expect(scenario.moveTo.moveRequestCount(scenario.entryIds[1])).toBe(2)

      for (const entry of scenario.entries) {
        await aliceDrive.row(entry).waitHidden()
      }
      await aliceDrive.openFolder(scenario.destination)
      for (const entry of scenario.entries) {
        await expect(aliceDrive.row(entry).cell).toBeVisible()
      }
    } finally {
      await scenario.moveTo.clearNetworkFailures()
      await cleanupMoveScenario(scenario.entries)
    }
  })

  test('keeps successful entries moved when cancelling after a partial success', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const scenario = await createMoveScenario(alicePage, aliceDrive)

    try {
      await scenario.moveTo.failMoves([scenario.entryIds[1]], true)
      await scenario.moveTo.clickMove()
      await scenario.moveTo.expectPartialResult(1, 1)
      await scenario.moveTo.close()
      await scenario.moveTo.expectSuccessNotification(scenario.entries[0])

      await aliceDrive.row(scenario.entries[0]).waitHidden()
      await expect(aliceDrive.row(scenario.entries[1]).cell).toBeVisible()
    } finally {
      await scenario.moveTo.clearNetworkFailures()
      await cleanupMoveScenario(scenario.entries)
    }
  })
})
