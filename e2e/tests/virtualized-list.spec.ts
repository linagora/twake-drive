import { USERS } from '../helpers/config'
import { expect, stamp, test } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { createFile, createFolder } from '../helpers/stack'

const ALICE = USERS.alice
// More than one page of the folder query (100): the last rows need the next one
const FILE_COUNT = 120

test.describe('Virtualized list', () => {
  test.beforeAll(() => {
    setFlags(ALICE.instance, {
      ...DEFAULT_FLAGS,
      'drive.virtualization.enabled': true
    })
  })
  test.afterAll(() => {
    // Setting flags merges them: the flag has to be turned off by name
    setFlags(ALICE.instance, {
      ...DEFAULT_FLAGS,
      'drive.virtualization.enabled': false
    })
  })

  test('scrolls through a large folder down to its last file', async ({
    alicePage,
    aliceDrive
  }) => {
    const folderId = await createFolder({
      instance: ALICE.instance,
      name: `Virtualized ${stamp()}`
    })
    const names = Array.from(
      { length: FILE_COUNT },
      (_, index) => `large-${String(index).padStart(3, '0')}.txt`
    )
    for (let start = 0; start < names.length; start += 20) {
      await Promise.all(
        names.slice(start, start + 20).map(name =>
          createFile({
            instance: ALICE.instance,
            name,
            content: name,
            parentId: folderId
          })
        )
      )
    }

    // Newest first: the first files created are at the bottom
    const oldest = names[0]
    const newest = names[names.length - 1]
    await alicePage.goto(`${ALICE.appUrl}/#/folder/${folderId}`)
    await expect(aliceDrive.virtualRow(newest)).toHaveCount(1)

    await aliceDrive.scrollVirtualizedListTo(oldest)

    await expect(aliceDrive.virtualRow(newest)).toHaveCount(0)
  })
})
