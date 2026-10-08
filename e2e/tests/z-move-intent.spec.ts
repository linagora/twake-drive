import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import {
  createFile,
  createFolder,
  trashById,
  trashByName
} from '../helpers/stack'
import { MoveIntentPage } from '../pages/MoveIntentPage'

test.describe('MOVE intent navigation', () => {
  let sourceId: string
  let sourceName: string
  let rootId: string
  let rootName: string
  let childName: string
  let hiddenFileName: string

  test.beforeAll(async () => {
    sourceName = `Move source ${stamp()}.txt`
    sourceId = await createFile({
      instance: USERS.alice.instance,
      name: sourceName,
      content: 'Unmoved source'
    })
    rootName = `Move starting folder ${stamp()}`
    rootId = await createFolder({
      instance: USERS.alice.instance,
      name: rootName
    })
    childName = `Move child ${stamp()}`
    await createFolder({
      instance: USERS.alice.instance,
      name: childName,
      parentId: rootId
    })
    hiddenFileName = `Move hidden file ${stamp()}.txt`
    await createFile({
      instance: USERS.alice.instance,
      name: hiddenFileName,
      parentId: rootId,
      content: 'Folders only'
    })
  })

  test.afterAll(async () => {
    await trashById(USERS.alice.instance, sourceId)
    await trashById(USERS.alice.instance, rootId)
  })

  test('handshakes with real MOVE service, starts in the requested folder and cancels without moving', async ({
    alicePage,
    aliceDrive
  }) => {
    const picker = new MoveIntentPage(alicePage)
    const id = await picker.open({
      fileIds: [sourceId],
      defaultDirId: rootId,
      theme: { type: 'dark' },
      tabs: ['sharings', 'drive', 'sharings']
    })
    await picker.waitReady()
    await picker.expectTabs(['My Drive', 'Sharings'])
    await picker.expectTheme('dark')
    await picker.expectBreadcrumb(rootName)
    await expect(picker.row(hiddenFileName)).toHaveCount(0)
    await picker.expectCanMove()
    await picker.navigateToFolder(childName)
    await expect
      .poll(
        async () =>
          (await picker.messages()).filter(message =>
            message.type.endsWith(':readyToUse')
          ).length
      )
      .toBe(1)
    await picker.cancel()
    expect(
      (await picker.messages()).filter(message =>
        ['ready', 'readyToUse', 'cancel'].some(type =>
          message.type.endsWith(`:${type}`)
        )
      )
    ).toEqual([
      { type: `intent-${id}:ready` },
      { type: `intent-${id}:readyToUse` },
      { type: `intent-${id}:cancel` }
    ])
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.row(sourceName).waitVisible()
  })

  test('restricts destinations to a local subtree while accepting a source outside it', async ({
    alicePage
  }) => {
    const picker = new MoveIntentPage(alicePage)
    await picker.open({
      fileIds: [sourceId],
      defaultDirId: rootId,
      restrictToDefaultDir: true
    })
    await picker.waitReady()
    await picker.expectTabs(['My Drive'])
    await picker.expectBreadcrumb('My Drive', false)
    await expect(picker.row(hiddenFileName)).toHaveCount(0)
    await picker.navigateToFolder(childName)
    await picker.expectBreadcrumb('My Drive', false)
    await picker.expectCanMove()
    await picker.cancel()
  })

  test('falls back to the ordinary root for an unavailable unrestricted starting folder', async ({
    alicePage,
    aliceDrive
  }) => {
    const picker = new MoveIntentPage(alicePage)
    await picker.open({
      fileIds: [sourceId],
      defaultDirId: `missing-${stamp()}`
    })
    await picker.waitReady()
    await picker.expectBreadcrumb('My Drive')
    await picker.expectTabs(['My Drive', 'Sharings'])
    await picker.cancel()
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.row(sourceName).waitVisible()
  })

  test('serializes an unavailable restricted root to the real caller without readiness', async ({
    alicePage
  }) => {
    const picker = new MoveIntentPage(alicePage)
    const id = await picker.open({
      fileIds: [sourceId],
      restrictToDefaultDir: true,
      defaultDirId: 'missing-root'
    })
    const message = await picker.waitError()
    expect(message.type).toBe(`intent-${id}:error`)
    expect(message.error?.name).toBe('Error')
    expect(message.error?.message).toEqual(expect.any(String))
    expect(message.error?.message.length).toBeGreaterThan(0)
    expect(
      (await picker.messages()).some(message =>
        message.type.endsWith(':readyToUse')
      )
    ).toBe(false)
    expect(message).not.toHaveProperty('document')
  })

  test('browses owned and received shared destinations without showing their files or moving before confirmation', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    const shareName = `MOVE shared destination ${stamp()}`
    const nestedName = `MOVE shared child ${stamp()}`
    const fileName = `MOVE shared hidden ${stamp()}.txt`
    const bobSourceName = `MOVE Bob source ${stamp()}.txt`
    const bobSourceId = await createFile({
      instance: USERS.bob.instance,
      name: bobSourceName,
      content: 'Unmoved Bob source'
    })
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, shareName, {
        seed: async () => {
          const folderId = new URL(alicePage.url()).hash.split('/').pop()
          if (!folderId) throw new Error('Shared folder route has no ID')
          await createFolder({
            instance: USERS.alice.instance,
            name: nestedName,
            parentId: folderId
          })
          await createFile({
            instance: USERS.alice.instance,
            name: fileName,
            parentId: folderId,
            content: 'Hidden shared file'
          })
        }
      })
      await openSharedDrive(bobPage, USERS.bob, bobDrive, shareName)
      const ownedPicker = new MoveIntentPage(alicePage)
      await ownedPicker.open({ fileIds: [sourceId] })
      await ownedPicker.waitReady()
      await ownedPicker.navigateToFolder(shareName)
      await expect(ownedPicker.row(nestedName)).toBeVisible()
      await expect(ownedPicker.row(fileName)).toHaveCount(0)
      await ownedPicker.cancel()
      const receivedPicker = new MoveIntentPage(bobPage, USERS.bob)
      await receivedPicker.open({ fileIds: [bobSourceId] })
      await receivedPicker.waitReady()
      await receivedPicker.selectSharings()
      await receivedPicker.navigateToFolder(shareName)
      await expect(receivedPicker.row(nestedName)).toBeVisible()
      await expect(receivedPicker.row(fileName)).toHaveCount(0)
      await receivedPicker.navigateToFolder(nestedName)
      await receivedPicker.expectCanMove()
      await receivedPicker.cancel()
      await bobPage.goto(`${USERS.bob.appUrl}/#/folder`)
      await bobDrive.row(bobSourceName).waitVisible()
    } finally {
      await trashById(USERS.bob.instance, bobSourceId)
      await trashByName(USERS.alice.instance, shareName)
    }
  })
})
