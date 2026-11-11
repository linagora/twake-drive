import { USERS } from '../helpers/config'
import { escapeRegExp, stamp, test } from '../helpers/fixtures'
import { createFile, createFolder } from '../helpers/stack'
import { FileViewerPage } from '../pages/FileViewerPage'
import { SearchPage } from '../pages/SearchPage'

const ALICE = USERS.alice

test.describe('Search', () => {
  test('opens a folder from its suggestion', async ({ alicePage }) => {
    const name = `Search folder ${stamp()}`
    const folderId = await createFolder({ instance: ALICE.instance, name })

    // The index is built when the view mounts: open it once the folder exists
    const search = new SearchPage(alicePage)
    await search.open(ALICE.appUrl)
    await search.search(name)
    await search.openSuggestion(name)

    await alicePage.waitForURL(
      new RegExp(`#/folder/${escapeRegExp(folderId)}$`)
    )
  })

  test('opens a file from its suggestion in the viewer', async ({
    alicePage
  }) => {
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: `Search parent ${stamp()}`
    })
    const name = `search-file-${stamp()}.txt`
    await createFile({
      instance: ALICE.instance,
      name,
      content: name,
      parentId: folderId
    })

    const search = new SearchPage(alicePage)
    await search.open(ALICE.appUrl)
    await search.search(name)
    await search.openSuggestion(name)

    const viewer = new FileViewerPage(alicePage)
    await viewer.waitForOpen()
    await viewer.expectFileName(name)
  })
})
