import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createAndShareFolderWithBob,
  openSharedDrive
} from '../helpers/sharing'
import {
  createFile,
  createFolder,
  fetchFileContent,
  trashById,
  trashByName
} from '../helpers/stack'
import { MoveIntentPage } from '../pages/MoveIntentPage'

test.describe('MOVE intent execution', () => {
  let sourceFolderId: string
  let destinationId: string
  let destinationName: string
  let sourceId: string
  let sourceName: string

  test.beforeAll(async () => {
    sourceFolderId = await createFolder({
      instance: USERS.alice.instance,
      name: `Intent sources ${stamp()}`
    })
    destinationName = `Intent destination ${stamp()}`
    destinationId = await createFolder({
      instance: USERS.alice.instance,
      name: destinationName
    })
  })
  test.afterAll(async () => {
    await trashById(USERS.alice.instance, sourceFolderId)
    await trashById(USERS.alice.instance, destinationId)
  })
  test.beforeEach(async () => {
    sourceName = `Intent source ${stamp()}.txt`
    sourceId = await createFile({
      instance: USERS.alice.instance,
      name: sourceName,
      parentId: sourceFolderId,
      content: 'Real MOVE content'
    })
  })

  test('moves a source outside a restricted destination subtree and returns complete mutation data without rereading the file', async ({
    alicePage,
    aliceDrive
  }) => {
    const picker = new MoveIntentPage(alicePage)
    await picker.open({
      fileIds: [sourceId],
      defaultDirId: destinationId,
      restrictToDefaultDir: true
    })
    await picker.waitReady()
    const initialReads = picker.readRequestCount(sourceId)
    await picker.confirmMove()
    const result = await picker.waitResult()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      _id: sourceId,
      _type: 'io.cozy.files',
      name: sourceName,
      dir_id: destinationId,
      path: `/${destinationName}/${sourceName}`,
      mime: 'text/plain'
    })
    expect(result[0]._rev).toEqual(expect.any(String))
    expect(Number(result[0].size)).toBeGreaterThan(0)
    expect(picker.readRequestCount(sourceId)).toBe(initialReads)
    expect(picker.moveRequestCount(sourceId)).toBe(1)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${sourceFolderId}`)
    await aliceDrive.row(sourceName).waitHidden()
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
    expect(
      await fetchFileContent({
        instance: USERS.alice.instance,
        fileId: result[0]._id
      })
    ).toBe('Real MOVE content')
  })

  test('creates a destination with the existing inline creation flow before moving', async ({
    alicePage,
    aliceDrive
  }) => {
    const picker = new MoveIntentPage(alicePage)
    await picker.open({ fileIds: [sourceId], defaultDirId: destinationId })
    await picker.waitReady()
    const folderName = `Intent created ${stamp()}`
    await picker.createFolder(folderName)
    await picker.navigateToFolder(folderName)
    await picker.confirmMove()
    const result = await picker.waitResult()
    expect(result[0].path).toBe(
      `/${destinationName}/${folderName}/${sourceName}`
    )
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${result[0].dir_id}`)
    await aliceDrive.row(sourceName).waitVisible()
  })

  test('replaces an existing destination file using the current move model conflict policy', async ({
    alicePage,
    aliceDrive
  }) => {
    await createFile({
      instance: USERS.alice.instance,
      name: sourceName,
      parentId: destinationId,
      content: 'Replaced content'
    })
    const picker = new MoveIntentPage(alicePage)
    await picker.open({ fileIds: [sourceId], defaultDirId: destinationId })
    await picker.waitReady()
    await picker.confirmMove()
    const result = await picker.waitResult()
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe(sourceId)
    expect(result[0].path).toBe(`/${destinationName}/${sourceName}`)
    expect(picker.moveRequestCount(sourceId)).toBe(2)
    expect(
      await fetchFileContent({
        instance: USERS.alice.instance,
        fileId: sourceId
      })
    ).toBe('Real MOVE content')
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
  })

  test('returns only the survivor when sources with the same name come from different parents', async ({
    alicePage,
    aliceDrive
  }) => {
    const parent = await createFolder({
      instance: USERS.alice.instance,
      name: `Second parent ${stamp()}`,
      parentId: sourceFolderId
    })
    const secondId = await createFile({
      instance: USERS.alice.instance,
      name: sourceName,
      parentId: parent,
      content: 'Surviving content'
    })
    const picker = new MoveIntentPage(alicePage)
    await picker.open({
      fileIds: [sourceId, secondId],
      defaultDirId: destinationId
    })
    await picker.waitReady()
    await picker.confirmMove()
    const result = await picker.waitResult()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      _id: secondId,
      name: sourceName,
      path: `/${destinationName}/${sourceName}`
    })
    expect(picker.moveRequestCount(sourceId)).toBe(1)
    expect(picker.moveRequestCount(secondId)).toBe(2)
    expect(
      await fetchFileContent({
        instance: USERS.alice.instance,
        fileId: secondId
      })
    ).toBe('Surviving content')
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${parent}`)
    await aliceDrive.row(sourceName).waitHidden()
  })

  test('freezes the destination after a partial success and retries only the failed source', async ({
    alicePage,
    aliceDrive
  }) => {
    const secondName = `Failed source ${stamp()}.txt`
    const secondId = await createFile({
      instance: USERS.alice.instance,
      name: secondName,
      parentId: sourceFolderId,
      content: 'Retried content'
    })
    const picker = new MoveIntentPage(alicePage)
    await picker.open({
      fileIds: [sourceId, secondId],
      defaultDirId: destinationId
    })
    await picker.waitReady()
    await picker.failNextMove(secondId)
    await picker.confirmMove()
    await picker.expectPartial(1, 1)
    expect(
      (await picker.messages()).some(message => message.type.endsWith(':done'))
    ).toBe(false)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${sourceFolderId}`)
    await aliceDrive.row(sourceName).waitHidden()
    await aliceDrive.row(secondName).waitVisible()
    await picker.confirmMove()
    const result = await picker.waitResult()
    expect(result.map(file => file._id)).toEqual([sourceId, secondId])
    expect(result.map(file => file.path)).toEqual([
      `/${destinationName}/${sourceName}`,
      `/${destinationName}/${secondName}`
    ])
    expect(picker.moveRequestCount(sourceId)).toBe(1)
    expect(picker.moveRequestCount(secondId)).toBe(2)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
    await aliceDrive.row(secondName).waitVisible()
  })

  test('cancels after a partial success without a payload or rollback', async ({
    alicePage,
    aliceDrive
  }) => {
    const secondName = `Cancelled pending ${stamp()}.txt`
    const secondId = await createFile({
      instance: USERS.alice.instance,
      name: secondName,
      parentId: sourceFolderId,
      content: 'Still pending'
    })
    const picker = new MoveIntentPage(alicePage)
    const id = await picker.open({
      fileIds: [sourceId, secondId],
      defaultDirId: destinationId
    })
    await picker.waitReady()
    await picker.failNextMove(secondId)
    await picker.confirmMove()
    await picker.expectPartial(1, 1)
    await picker.cancel()
    expect(
      (await picker.messages()).find(message =>
        message.type.endsWith(':cancel')
      )
    ).toEqual({ type: `intent-${id}:cancel` })
    expect(
      (await picker.messages()).some(message => message.type.endsWith(':done'))
    ).toBe(false)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${sourceFolderId}`)
    await aliceDrive.row(sourceName).waitHidden()
    await aliceDrive.row(secondName).waitVisible()
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
    await aliceDrive.row(secondName).waitHidden()
  })

  test('retries parent-path finalization without replaying the successful mutation or rereading a complete file response', async ({
    alicePage,
    aliceDrive
  }) => {
    const picker = new MoveIntentPage(alicePage)
    await picker.open({ fileIds: [sourceId], defaultDirId: destinationId })
    await picker.waitReady()
    const initialReads = picker.readRequestCount(sourceId)
    const releaseParent = await picker.failResultParentReads(
      sourceId,
      destinationId
    )
    await picker.confirmMove()
    await picker.expectFinalizationError()
    expect(picker.moveRequestCount(sourceId)).toBe(1)
    expect(picker.readRequestCount(sourceId)).toBe(initialReads)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${sourceFolderId}`)
    await aliceDrive.row(sourceName).waitHidden()
    releaseParent()
    await picker.retryResult()
    const result = await picker.waitResult()
    expect(result[0].path).toBe(`/${destinationName}/${sourceName}`)
    expect(picker.moveRequestCount(sourceId)).toBe(1)
    expect(picker.readRequestCount(sourceId)).toBe(initialReads)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
  })

  test('fetches a file only when an actual successful mutation response is deliberately made incomplete', async ({
    alicePage,
    aliceDrive
  }) => {
    const picker = new MoveIntentPage(alicePage)
    await picker.open({ fileIds: [sourceId], defaultDirId: destinationId })
    await picker.waitReady()
    const initialReads = picker.readRequestCount(sourceId)
    await picker.makeNextMoveResponseIncomplete(sourceId)
    await picker.confirmMove()
    const result = await picker.waitResult()
    expect(result[0]).toMatchObject({
      _id: sourceId,
      mime: 'text/plain',
      dir_id: destinationId,
      path: `/${destinationName}/${sourceName}`
    })
    expect(picker.readRequestCount(sourceId)).toBe(initialReads + 1)
    expect(picker.moveRequestCount(sourceId)).toBe(1)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
  })

  test('warns before moving a later owned-shared source out of its sharing, even when the first source is private', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    const shareName = `Mixed source share ${stamp()}`
    const sharedFileName = `Mixed shared file ${stamp()}.txt`
    let sharedSourceId = ''
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, shareName, {
        seed: async () => {
          const parentId = new URL(alicePage.url()).hash.split('/').pop()
          if (!parentId) throw new Error('Missing sharing folder route')
          sharedSourceId = await createFile({
            instance: USERS.alice.instance,
            name: sharedFileName,
            parentId,
            content: 'Shared source content'
          })
        }
      })
      await openSharedDrive(bobPage, USERS.bob, bobDrive, shareName)
      const picker = new MoveIntentPage(alicePage)
      await picker.open({
        fileIds: [sourceId, sharedSourceId],
        defaultDirId: destinationId
      })
      await picker.waitReady()
      await picker.confirmMove()
      await bobDrive.row(sharedFileName).waitVisible()
      await picker.confirmOutsideSharing(shareName)
      const result = await picker.waitResult()
      expect(result.map(file => file.path)).toEqual([
        `/${destinationName}/${sourceName}`,
        `/${destinationName}/${sharedFileName}`
      ])
      await bobDrive.row(sharedFileName).waitHidden()
      await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
      await aliceDrive.row(sourceName).waitVisible()
      await aliceDrive.row(sharedFileName).waitVisible()
    } finally {
      await trashByName(USERS.alice.instance, shareName)
    }
  })

  for (const nested of [false, true]) {
    test(`moves into an owned shared ${nested ? 'nested' : 'root'} destination and returns the real final document`, async ({
      alicePage,
      aliceDrive,
      bobPage,
      bobDrive
    }) => {
      const shareName = `Intent owned share ${stamp()}`
      const nestedName = `Intent nested ${stamp()}`
      try {
        await createAndShareFolderWithBob(alicePage, aliceDrive, shareName, {
          seed: async () => {
            await aliceDrive.createFolder(nestedName)
          }
        })
        await openSharedDrive(bobPage, USERS.bob, bobDrive, shareName)
        const picker = new MoveIntentPage(alicePage)
        await picker.open({ fileIds: [sourceId] })
        await picker.waitReady()
        await picker.navigateToFolder(shareName)
        if (nested) await picker.navigateToFolder(nestedName)
        const initialReads = picker.readRequestCount(sourceId)
        await picker.confirmMove()
        await picker.confirmInsideSharing()
        const result = await picker.waitResult()
        expect(result[0].path).toBe(
          `/${shareName}${nested ? `/${nestedName}` : ''}/${sourceName}`
        )
        expect(picker.crossDriveMoveRequestCount()).toBe(1)
        expect(picker.readRequestCount(sourceId)).toBe(initialReads)
        if (nested) await bobDrive.row(nestedName).open()
        await bobDrive.row(sourceName).waitVisible()
        expect(
          await fetchFileContent({
            instance: USERS.alice.instance,
            fileId: result[0]._id
          })
        ).toBe('Real MOVE content')
      } finally {
        await trashByName(USERS.alice.instance, shareName)
      }
    })
  }

  test('moves a local recipient file into a received shared destination and returns its owner-side path and identity', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    const shareName = `Intent received destination ${stamp()}`
    const bobParent = await createFolder({
      instance: USERS.bob.instance,
      name: `Bob MOVE sources ${stamp()}`
    })
    const bobName = `Bob MOVE ${stamp()}.txt`
    const bobId = await createFile({
      instance: USERS.bob.instance,
      parentId: bobParent,
      name: bobName,
      content: 'Recipient source content'
    })
    try {
      await createAndShareFolderWithBob(alicePage, aliceDrive, shareName)
      await openSharedDrive(bobPage, USERS.bob, bobDrive, shareName)
      const picker = new MoveIntentPage(bobPage, USERS.bob)
      await picker.open({ fileIds: [bobId] })
      await picker.waitReady()
      await picker.selectSharings()
      await picker.navigateToFolder(shareName)
      await picker.confirmMove()
      await picker.confirmInsideSharing()
      const result = await picker.waitResult()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe(bobName)
      expect(result[0].path).toBe(`/${shareName}/${bobName}`)
      expect(picker.crossDriveMoveRequestCount()).toBe(1)
      await aliceDrive.row(bobName).waitVisible()
      expect(
        await fetchFileContent({
          instance: USERS.alice.instance,
          fileId: result[0]._id
        })
      ).toBe('Recipient source content')
      await bobPage.goto(`${USERS.bob.appUrl}/#/folder/${bobParent}`)
      await bobDrive.row(bobName).waitHidden()
    } finally {
      await trashById(USERS.bob.instance, bobParent)
      await trashByName(USERS.alice.instance, shareName)
    }
  })
})
