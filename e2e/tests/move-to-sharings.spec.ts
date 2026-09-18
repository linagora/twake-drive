import { copyFile, readFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { expect, safeUnlink, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openOwnerFolder,
  openSharedDrive
} from '../helpers/sharing'
import { fetchFileContent, trashByName } from '../helpers/stack'

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')
const BOB_ROOT = `${USERS.bob.appUrl}/#/folder`
const EDITOR_SHARE = `Move Editor Share ${stamp()}`
const DESTINATION_SHARE = `Move Destination Share ${stamp()}`
const VIEWER_SHARE = `Move Viewer Share ${stamp()}`
const NESTED_DESTINATION = `Move Nested Destination ${stamp()}`

test.describe.serial('MoveTo received sharings', () => {
  test('sets up received sharing destinations', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, EDITOR_SHARE, {
      seed: async () => {
        await aliceDrive.createFolder(NESTED_DESTINATION)
      }
    })
    await createAndShareFolderWithBob(alicePage, aliceDrive, VIEWER_SHARE, {
      role: 'Viewer'
    })

    await charliePage.goto(`${USERS.charlie.appUrl}/#/folder`)
    await charlieDrive.createFolder(DESTINATION_SHARE)
    await charlieDrive.openFolder(DESTINATION_SHARE)
    const shareModal = await charlieDrive.openShareModal()
    await shareModal.addMember(USERS.bob.email)
    await shareModal.share()

    await openSharedDrive(bobPage, USERS.bob, bobDrive, EDITOR_SHARE)
    await openSharedDrive(bobPage, USERS.bob, bobDrive, DESTINATION_SHARE)
    await openSharedDrive(bobPage, USERS.bob, bobDrive, VIEWER_SHARE)
  })

  test('moves a file into a nested received folder', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    const sourceFile = `Move shared file ${stamp()}.txt`
    const sourcePath = path.join(path.dirname(FIXTURE), sourceFile)
    await copyFile(FIXTURE, sourcePath)

    try {
      await bobPage.goto(BOB_ROOT)
      await bobDrive.uploadFiles(sourcePath)
      await bobDrive.row(sourceFile).waitVisible()

      const moveTo = await bobDrive.row(sourceFile).openMoveTo()
      await moveTo.expectDestinationTabs()
      await moveTo.openSharings()
      await moveTo.openFolder(EDITOR_SHARE)
      await moveTo.openFolder(NESTED_DESTINATION)
      await moveTo.confirmSharedFolderMove()

      await bobPage.reload()
      await bobDrive.row(sourceFile).waitHidden()
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, EDITOR_SHARE)
      await aliceDrive.openFolder(NESTED_DESTINATION)
      await expect(async () => {
        await alicePage.reload()
        await aliceDrive.row(sourceFile).waitVisible({ timeout: 5_000 })
      }).toPass({ timeout: 30_000 })
    } finally {
      await trashByName(USERS.bob.instance, sourceFile)
      await safeUnlink(sourcePath)
    }
  })

  test('moves a folder into a destination created inside a received folder', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    const sourceFolder = `Move shared folder ${stamp()}`
    const childFile = `Move shared child ${stamp()}.txt`
    const childPath = path.join(path.dirname(FIXTURE), childFile)
    const createdDestination = `Move created destination ${stamp()}`
    await copyFile(FIXTURE, childPath)

    try {
      await bobPage.goto(BOB_ROOT)
      await bobDrive.createFolder(sourceFolder)
      await bobDrive.openFolder(sourceFolder)
      await bobDrive.uploadFiles(childPath)
      await bobDrive.row(childFile).waitVisible()
      await bobPage.goto(BOB_ROOT)

      const moveTo = await bobDrive.row(sourceFolder).openMoveTo()
      await moveTo.openSharings()
      await moveTo.openFolder(EDITOR_SHARE)
      await moveTo.showFolderCreation()
      await moveTo.creationInput.fill(createdDestination)
      await moveTo.creationInput.press('Enter')

      await expect(moveTo.creationForm).toBeHidden()
      await expect(moveTo.isFolderSelected(createdDestination)).resolves.toBe(
        false
      )
      await moveTo.openFolder(createdDestination)
      await moveTo.confirmSharedFolderMove()

      await bobPage.reload()
      await bobDrive.row(sourceFolder).waitHidden()
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, EDITOR_SHARE)
      await expect(async () => {
        await alicePage.reload()
        await aliceDrive.row(createdDestination).waitVisible({ timeout: 5_000 })
      }).toPass({ timeout: 30_000 })
      await aliceDrive.openFolder(createdDestination)
      await aliceDrive.openFolder(sourceFolder)
      await expect(aliceDrive.row(childFile).cell).toBeVisible()
    } finally {
      await trashByName(USERS.bob.instance, sourceFolder)
      await safeUnlink(childPath)
    }
  })

  test('moves a file between federated shared drives owned by different users', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    const sourceFile = `Move between shares ${stamp()}.txt`
    const sourcePath = path.join(path.dirname(FIXTURE), sourceFile)
    await copyFile(FIXTURE, sourcePath)

    try {
      await openOwnerFolder(alicePage, USERS.alice, aliceDrive, EDITOR_SHARE)
      await aliceDrive.uploadFiles(sourcePath)
      await aliceDrive.row(sourceFile).waitVisible()

      await openSharedDrive(bobPage, USERS.bob, bobDrive, EDITOR_SHARE)
      await bobDrive.row(sourceFile).waitVisible({ timeout: 10_000 })

      const moveTo = await bobDrive.row(sourceFile).openMoveTo()
      await moveTo.openSharings()
      await moveTo.openFolder(DESTINATION_SHARE)
      await moveTo.confirmSharedFolderMove()

      await bobPage.reload()
      await bobDrive.row(sourceFile).waitHidden()

      await expect(async () => {
        await alicePage.reload()
        await aliceDrive.row(sourceFile).waitHidden({ timeout: 5_000 })
      }).toPass({ timeout: 30_000 })

      await openOwnerFolder(
        charliePage,
        USERS.charlie,
        charlieDrive,
        DESTINATION_SHARE
      )
      await expect(async () => {
        await charliePage.reload()
        await charlieDrive.row(sourceFile).waitVisible({ timeout: 5_000 })
      }).toPass({ timeout: 30_000 })

      const destinationFileId = await charlieDrive.row(sourceFile).fileId()
      const expectedContent = await readFile(FIXTURE, 'utf8')
      await expect(
        fetchFileContent({
          instance: USERS.charlie.instance,
          fileId: destinationFileId
        })
      ).resolves.toBe(expectedContent)

      await openSharedDrive(bobPage, USERS.bob, bobDrive, DESTINATION_SHARE)
      await bobDrive.row(sourceFile).waitVisible({ timeout: 10_000 })
    } finally {
      await safeUnlink(sourcePath)
    }
  })

  test('keeps a Viewer sharing visible but disabled', async ({
    bobPage,
    bobDrive
  }) => {
    await bobPage.goto(BOB_ROOT)

    const moveTo = await bobDrive.row('Administrative').openMoveTo()
    await moveTo.openSharings()
    await moveTo.expectFolderDisabled(VIEWER_SHARE, /read-only/i)
    await moveTo.expectMoveDisabled()
    await expect(moveTo.createFolderButton).toHaveCount(0)
    await moveTo.close()

    await expect(bobDrive.row('Administrative').cell).toBeVisible()
  })
})
