import { copyFile } from 'fs/promises'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp, safeUnlink } from '../helpers/fixtures'
import { SidebarPage } from '../pages/SidebarPage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'sample.txt')

test.describe('Navigation surfaces', () => {
  test('Recent: a freshly uploaded file shows up at /#/recent', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const sidebar = new SidebarPage(alicePage)
    const file = path.join(path.dirname(FIXTURE), `recent-${stamp()}.txt`)
    await copyFile(FIXTURE, file)
    try {
      const fileName = path.basename(file)
      await aliceDrive.uploadFiles(file)
      await aliceDrive.row(fileName).waitVisible()

      await sidebar.goToRecent()
      await alicePage.waitForURL(/\/recent/)
      await aliceDrive.row(fileName).waitVisible()
    } finally {
      await safeUnlink(file)
    }
  })

  test('Favorites: a favourited file appears in /#/favorites', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const sidebar = new SidebarPage(alicePage)
    const file = path.join(path.dirname(FIXTURE), `fav-${stamp()}.txt`)
    await copyFile(FIXTURE, file)
    try {
      const fileName = path.basename(file)
      await aliceDrive.uploadFiles(file)
      const row = aliceDrive.row(fileName)
      await row.waitVisible()
      await row.addToFavorites()

      await sidebar.goToFavorites()
      await alicePage.waitForURL(/\/favorites/)
      await aliceDrive.row(fileName).waitVisible()
    } finally {
      await safeUnlink(file)
    }
  })

  test('Trash: a deleted folder is reachable from the Bin sidebar entry', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const sidebar = new SidebarPage(alicePage)
    const name = `Trashable ${stamp()}`
    await aliceDrive.createFolder(name)
    await aliceDrive.row(name).sendToTrash()

    await sidebar.goToTrash()
    await alicePage.waitForURL(/\/trash/)
    await aliceDrive.row(name).waitVisible()
  })
})
