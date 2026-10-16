import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import {
  createFile,
  createFolder,
  fetchFileContent,
  trashById
} from '../helpers/stack'
import { MoveIntentDemoPage } from '../pages/MoveIntentDemoPage'

test.describe('MOVE demo page', () => {
  let sourceId: string
  let sourceTrashed: boolean
  let sourceName: string
  let destinationId: string
  let destinationName: string

  test.beforeEach(async () => {
    sourceTrashed = false
    sourceName = `Demo source ${stamp()}.txt`
    sourceId = await createFile({
      instance: USERS.alice.instance,
      name: sourceName,
      content: 'Demo source content'
    })
    destinationName = `Demo destination ${stamp()}`
    destinationId = await createFolder({
      instance: USERS.alice.instance,
      name: destinationName
    })
  })

  test.afterEach(async () => {
    if (!sourceTrashed) await trashById(USERS.alice.instance, sourceId)
    await trashById(USERS.alice.instance, destinationId)
  })

  test('is discoverable only when enabled', async ({ alicePage }) => {
    const demo = new MoveIntentDemoPage(alicePage)
    try {
      setFlags(USERS.alice.instance, {
        ...DEFAULT_FLAGS,
        'drive.move-intent-demo.enabled': false
      })
      await demo.expectUnavailable()
    } finally {
      setFlags(USERS.alice.instance, DEFAULT_FLAGS)
    }
    await demo.followSidebarLink()
  })

  test('moves a user-chosen file through the real caller and blocks busy host dismissal', async ({
    alicePage,
    aliceDrive
  }) => {
    const demo = new MoveIntentDemoPage(alicePage)
    await demo.start({
      sourceNames: [sourceName],
      directoryName: destinationName
    })
    await demo.expectTabs(['My Drive', 'Sharings'])
    expect(demo.moveRequestCount(sourceId)).toBe(0)
    const release = await demo.blockNextMove(sourceId)
    try {
      await demo.confirmMove()
      await demo.expectBusy()
    } finally {
      release()
    }
    const files = await demo.waitResult()
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({
      _id: sourceId,
      dir_id: destinationId,
      path: `/${destinationName}/${sourceName}`
    })
    expect(demo.moveRequestCount(sourceId)).toBe(1)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.row(sourceName).waitHidden()
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitVisible()
    expect(
      await fetchFileContent({
        instance: USERS.alice.instance,
        fileId: sourceId
      })
    ).toBe('Demo source content')
  })

  test('moves multiple outside sources into a restricted destination', async ({
    alicePage,
    aliceDrive
  }) => {
    const secondName = `Demo second ${stamp()}.txt`
    const secondId = await createFile({
      instance: USERS.alice.instance,
      name: secondName,
      content: 'Second content'
    })
    try {
      const demo = new MoveIntentDemoPage(alicePage)
      await demo.start({
        sourceNames: [sourceName, secondName],
        directoryName: destinationName,
        restrictToDefaultDir: true
      })
      await demo.expectTabs(['My Drive'])
      await demo.expectBreadcrumb('My Drive', false)
      await demo.confirmMove()
      const files = await demo.waitResult()
      expect(files).toHaveLength(2)
      expect(files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: sourceId,
            dir_id: destinationId,
            path: `/${destinationName}/${sourceName}`
          }),
          expect.objectContaining({
            _id: secondId,
            dir_id: destinationId,
            path: `/${destinationName}/${secondName}`
          })
        ])
      )
      await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
      await aliceDrive.row(sourceName).waitHidden()
      await aliceDrive.row(secondName).waitHidden()
      await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
      await aliceDrive.row(sourceName).waitVisible()
      await aliceDrive.row(secondName).waitVisible()
      expect(
        await fetchFileContent({
          instance: USERS.alice.instance,
          fileId: secondId
        })
      ).toBe('Second content')
    } finally {
      await trashById(USERS.alice.instance, secondId)
    }
  })

  test('cancels through the service without moving or producing results', async ({
    alicePage,
    aliceDrive
  }) => {
    const demo = new MoveIntentDemoPage(alicePage)
    await demo.start({
      sourceNames: [sourceName],
      directoryName: destinationName,
      driveOnly: true
    })
    await demo.expectTabs(['My Drive'])
    await demo.cancel()
    await demo.expectDismissed()
    expect(demo.moveRequestCount(sourceId)).toBe(0)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.row(sourceName).waitVisible()
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${destinationId}`)
    await aliceDrive.row(sourceName).waitHidden()
  })

  test('shows a real initialization error and supports documented reload recovery', async ({
    alicePage,
    aliceDrive
  }) => {
    const demo = new MoveIntentDemoPage(alicePage)
    await demo.prepare({ sourceNames: [sourceName] })
    await trashById(USERS.alice.instance, sourceId)
    sourceTrashed = true
    const mutationsBeforeOpen = demo.moveRequestCount(sourceId)
    await demo.openMove(false)
    await demo.expectTerminalError()
    expect(demo.moveRequestCount(sourceId)).toBe(mutationsBeforeOpen)
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.row(sourceName).waitHidden()
    await aliceDrive.row(destinationName).waitVisible()
  })
})
