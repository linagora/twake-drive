import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import {
  createFile,
  createFolder,
  fetchFileContent,
  trashById
} from '../helpers/stack'
import { MoveIntentDemoPage } from '../pages/MoveIntentDemoPage'

test('opens the real demo at touch width and moves into a nested destination', async ({
  alicePage,
  aliceDrive
}) => {
  const rootName = `Demo touch root ${stamp()}`
  const rootId = await createFolder({
    instance: USERS.alice.instance,
    name: rootName
  })
  const nestedName = `Demo touch nested ${stamp()}`
  const nestedId = await createFolder({
    instance: USERS.alice.instance,
    name: nestedName,
    parentId: rootId
  })
  const sourceName = `Demo touch source ${stamp()}.txt`
  const sourceId = await createFile({
    instance: USERS.alice.instance,
    name: sourceName,
    content: 'Demo touch content'
  })
  try {
    const demo = new MoveIntentDemoPage(alicePage)
    await demo.start({
      sourceNames: [sourceName],
      directoryName: rootName,
      restrictToDefaultDir: true
    })
    await demo.expectFullScreenTouch()
    await demo.expectTabs(['My Drive'])
    await demo.navigateToFolderOnMobile(nestedName)
    await demo.confirmMove()
    const files = await demo.waitResult()
    expect(files[0]).toMatchObject({
      _id: sourceId,
      dir_id: nestedId,
      path: `/${rootName}/${nestedName}/${sourceName}`
    })
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.row(sourceName).waitHidden()
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder/${nestedId}`)
    await aliceDrive.row(sourceName).waitVisible()
    expect(
      await fetchFileContent({
        instance: USERS.alice.instance,
        fileId: sourceId
      })
    ).toBe('Demo touch content')
  } finally {
    await trashById(USERS.alice.instance, sourceId)
    await trashById(USERS.alice.instance, rootId)
  }
})
