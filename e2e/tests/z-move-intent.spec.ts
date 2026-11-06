import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import {
  createFile,
  createFolder,
  makeFilesToken,
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
    childName = `Z Move child ${stamp()}`
    await createFolder({
      instance: USERS.alice.instance,
      name: childName,
      parentId: rootId
    })
    hiddenFileName = `A Move context file ${stamp()}.txt`
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
    await picker.expectFolderBeforeFile(childName, hiddenFileName)
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
    await picker.expectRowDisabled(hiddenFileName)
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

  test('browses owned and received shared destinations showing their files as disabled without moving before confirmation', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    const shareName = `MOVE shared destination ${stamp()}`
    const nestedName = `Z MOVE shared child ${stamp()}`
    const fileName = `A MOVE shared context ${stamp()}.txt`
    const bobSourceName = `MOVE Bob source ${stamp()}.txt`
    let sharedFolderId = ''
    const bobSourceId = await createFile({
      instance: USERS.bob.instance,
      name: bobSourceName,
      content: 'Unmoved Bob source'
    })
    const fillerIds: string[] = []
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, shareName, {
        seed: async () => {
          const folderId = new URL(alicePage.url()).hash.split('/').pop()
          if (!folderId) throw new Error('Shared folder route has no ID')
          sharedFolderId = folderId
          await createFolder({
            instance: USERS.alice.instance,
            name: nestedName,
            parentId: folderId
          })
          const token = makeFilesToken(USERS.alice.instance)
          for (let index = 0; index < 100; index += 10) {
            await Promise.all(
              Array.from({ length: 10 }, (_, offset) =>
                createFile({
                  instance: USERS.alice.instance,
                  name: `B MOVE context ${String(index + offset).padStart(3, '0')}.txt`,
                  parentId: folderId,
                  content: 'Shared file',
                  token
                })
              )
            )
          }
          await createFile({
            instance: USERS.alice.instance,
            name: fileName,
            parentId: folderId,
            content: 'Shared file',
            token
          })
        }
      })
      await openSharedDrive(bobPage, USERS.bob, bobDrive, shareName)
      for (let index = 0; index < 20; index++) {
        fillerIds.push(
          await createFile({
            instance: USERS.alice.instance,
            name: `MOVE filler ${stamp()}.txt`,
            content: 'Filler'
          })
        )
      }
      const ownedPicker = new MoveIntentPage(alicePage)
      await ownedPicker.open({ fileIds: [sourceId] })
      await ownedPicker.waitReady()
      await ownedPicker.navigateToFolder(shareName)
      await ownedPicker.expectFolderBeforeFile(nestedName, fileName)
      await ownedPicker.cancel()
      const failingPicker = new MoveIntentPage(bobPage, USERS.bob)
      await failingPicker.open({ fileIds: [bobSourceId] })
      await failingPicker.waitReady()
      await failingPicker.selectSharings()
      await failingPicker.failNextSharedPage(sharedFolderId)
      await failingPicker.navigateToFolder(shareName)
      await failingPicker.expectSourceError()
      await failingPicker.cancel()
      const receivedPicker = new MoveIntentPage(bobPage, USERS.bob)
      await receivedPicker.open({ fileIds: [bobSourceId] })
      await receivedPicker.waitReady()
      await receivedPicker.selectSharings()
      await receivedPicker.navigateToFolder(shareName)
      await receivedPicker.expectFolderBeforeFile(nestedName, fileName)
      await receivedPicker.expectSharedPagination(sharedFolderId)
      await receivedPicker.navigateToFolder(nestedName)
      await receivedPicker.expectCanMove()
      await receivedPicker.cancel()
      await bobPage.goto(`${USERS.bob.appUrl}/#/folder`)
      await bobDrive.row(bobSourceName).waitVisible()
    } finally {
      for (const id of fillerIds) await trashById(USERS.alice.instance, id)
      await trashById(USERS.bob.instance, bobSourceId)
      await trashByName(USERS.alice.instance, shareName)
    }
  })
})
