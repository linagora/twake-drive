import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import {
  createAndShareFolderWithBob,
  openSharedDrive,
  waitForSharingRow
} from '../helpers/sharing'
import { trashByName } from '../helpers/stack'
import { DowngradeConfirmDialogPage } from '../pages/DowngradeConfirmDialogPage'

const PARENT_FOLDER = `Parent Folder ${stamp()}`
const NESTED_FOLDER = `Nested Folder ${stamp()}`
const NESTED_CHARLIE_FOLDER = `Nested Charlie ${stamp()}`
const PARENT_EDITOR_FOLDER = `Parent Editor ${stamp()}`
const NESTED_EDITOR_FOLDER = `Nested Editor ${stamp()}`

test.describe
  .serial('Nested folder role bug linagora/twake-drive#4200 and #4220', () => {
  test.beforeAll(() => {
    for (const u of [USERS.alice, USERS.bob, USERS.charlie]) {
      setFlags(u.instance, {
        ...DEFAULT_FLAGS,
        'drive.file-picker-demo.enabled': false,
        'cozy.hide-sharing-cozy-to-cozy': false
      })
    }
  })

  test.afterAll(async () => {
    try {
      await trashByName(USERS.alice.instance, PARENT_FOLDER)
    } catch {}
    try {
      await trashByName(USERS.alice.instance, PARENT_EDITOR_FOLDER)
    } catch {}
    for (const u of [USERS.alice, USERS.bob, USERS.charlie]) {
      setFlags(u.instance, DEFAULT_FLAGS)
    }
  })

  test('Alice changes Bob role on nested from Viewer to Editor without mutating parent role', async ({
    alicePage,
    aliceDrive
  }) => {
    // 1. Alice creates parent folder, seeds nested folder, and shares parent with Bob as Viewer
    await createAndShareFolderWithBob(alicePage, aliceDrive, PARENT_FOLDER, {
      role: 'Viewer',
      seed: async () => {
        await aliceDrive.createFolder(NESTED_FOLDER)
        await aliceDrive.row(NESTED_FOLDER).waitVisible()
      }
    })

    // Alice is already inside parent folder; wait for nested folder row
    await aliceDrive.row(NESTED_FOLDER).waitVisible()

    // 2. Open share modal on nested folder and verify Bob has Viewer role
    const modal = await aliceDrive.row(NESTED_FOLDER).share()
    await expect(modal.memberItem('bob')).toContainText(/viewer/i)

    // 3. Alice changes Bob's role on nested from Viewer to Editor
    await modal.setMemberRole('bob', 'Editor')
    await expect(modal.memberItem('bob')).toContainText(/editor/i)
    await modal.close()

    // 4. Verify Alice's parent folder share modal still has Bob as Viewer
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    const parentModal = await aliceDrive.row(PARENT_FOLDER).share()

    // In issue linagora/twake-drive#4200:
    // Expected: Bob remains Viewer on parent
    await expect(parentModal.memberItem('bob')).toContainText(/viewer/i)
    await parentModal.close()
  })

  test('Bob opens parent then navigates to nested: Bob has write access on nested (linagora/twake-drive#4220)', async ({
    bobPage,
    bobDrive
  }) => {
    // 1. Bob opens parent shared drive from Sharings
    await openSharedDrive(bobPage, USERS.bob, bobDrive, PARENT_FOLDER)

    // 2. In parent folder, Bob is Viewer -> Upload button is disabled
    await expect(bobDrive.uploadButton).toBeDisabled()
    await bobDrive.row(NESTED_FOLDER).waitVisible()

    // 3. Bob navigates into nested folder from parent
    await bobDrive.row(NESTED_FOLDER).open()
    await bobPage.waitForURL(/\/shareddrive\/[^/]+\/[^/]+/)

    // 4. In nested folder, Bob has Editor access -> Upload button is enabled
    await expect(bobDrive.uploadButton).toBeEnabled()

    // 5. Bob can create a folder inside nested
    const BOB_SUBFOLDER = `Bob Folder ${stamp()}`
    await bobDrive.createFolder(BOB_SUBFOLDER)
    await bobDrive.row(BOB_SUBFOLDER).waitVisible()
    await bobPage.goto('about:blank')
  })

  test('Alice adds Charlie to nested folder: Charlie does not exist in parent folder', async ({
    alicePage,
    aliceDrive
  }) => {
    // 1. Alice opens parent folder and creates a new nested folder for Charlie
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    await aliceDrive.openFolder(PARENT_FOLDER)
    await aliceDrive.createFolder(NESTED_CHARLIE_FOLDER)
    await aliceDrive.row(NESTED_CHARLIE_FOLDER).waitVisible()

    // 2. Alice opens share modal for nested folder and adds Charlie as Editor
    const modal = await aliceDrive.row(NESTED_CHARLIE_FOLDER).share()
    await modal.addMember(USERS.charlie.email)
    await modal.share()

    // 3. Reopening nested folder modal confirms Charlie is an Editor
    const childModal = await aliceDrive.row(NESTED_CHARLIE_FOLDER).share()
    await expect(childModal.memberItem('charlie')).toContainText(/editor/i)
    await childModal.close()

    // 4. Checking parent folder modal confirms Charlie is NOT added to parent folder
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    const parentModal = await aliceDrive.row(PARENT_FOLDER).share()
    await expect(parentModal.memberItem('bob')).toContainText(/viewer/i)
    await expect(parentModal.memberItem('charlie')).toHaveCount(0)
    await parentModal.close()
  })

  test('Charlie accesses nested folder with write access and has no access to parent folder', async ({
    charliePage,
    charlieDrive
  }) => {
    // 1. Charlie verifies Sharings with-me tab: sees nested folder, but does NOT see parent folder
    await waitForSharingRow(
      charliePage,
      USERS.charlie,
      charlieDrive,
      NESTED_CHARLIE_FOLDER
    )
    await expect(charlieDrive.row(PARENT_FOLDER).cell).toHaveCount(0)

    // 2. Charlie opens nested folder
    await openSharedDrive(
      charliePage,
      USERS.charlie,
      charlieDrive,
      NESTED_CHARLIE_FOLDER
    )

    // 3. Charlie has Editor access -> Upload is enabled and can create a subfolder
    await expect(charlieDrive.uploadButton).toBeEnabled()
    const CHARLIE_SUBFOLDER = `Charlie Folder ${stamp()}`
    await charlieDrive.createFolder(CHARLIE_SUBFOLDER)
    await charlieDrive.row(CHARLIE_SUBFOLDER).waitVisible()
    await charliePage.goto('about:blank')
  })

  test('Alice downgrades Bob on nested folder when Bob has greater permission (Editor) on parent folder', async ({
    alicePage,
    aliceDrive
  }) => {
    // 1. Alice creates parent folder with Bob as Editor and seeds nested folder
    await createAndShareFolderWithBob(
      alicePage,
      aliceDrive,
      PARENT_EDITOR_FOLDER,
      {
        role: 'Editor',
        seed: async () => {
          await aliceDrive.createFolder(NESTED_EDITOR_FOLDER)
          await aliceDrive.row(NESTED_EDITOR_FOLDER).waitVisible()
        }
      }
    )

    await aliceDrive.row(NESTED_EDITOR_FOLDER).waitVisible()

    // 2. Open share modal on nested folder: Bob is inherited with Editor role
    const modal = await aliceDrive.row(NESTED_EDITOR_FOLDER).share()
    await expect(modal.memberItem('bob')).toContainText(/editor/i)

    // 3. Alice attempts to downgrade Bob to Viewer -> Downgrade confirmation dialog appears
    await modal.selectMemberRole('bob', 'Viewer')
    const confirmDialog = new DowngradeConfirmDialogPage(alicePage)
    await confirmDialog.waitForOpen()
    await expect(confirmDialog.contactName()).toHaveText('bob')
    await expect(confirmDialog.folderRow(PARENT_EDITOR_FOLDER)).toBeVisible()
    await expect(confirmDialog.folderRow(NESTED_EDITOR_FOLDER)).toBeVisible()

    // 4. Cancelling keeps Bob as Editor
    await confirmDialog.cancel()
    await expect(modal.memberRole('bob')).toHaveText(/editor/i)

    // 5. Confirming downgrade updates Bob's role to Viewer
    await modal.selectMemberRole('bob', 'Viewer')
    await confirmDialog.waitForOpen()
    await confirmDialog.confirm()
    await expect(modal.memberRole('bob')).toHaveText(/viewer/i)
    await modal.close()

    // 6. Verify parent folder share modal also downgraded Bob to Viewer
    await alicePage.goto(`${USERS.alice.appUrl}/#/folder`)
    const parentModal = await aliceDrive.row(PARENT_EDITOR_FOLDER).share()
    await expect(parentModal.memberItem('bob')).toContainText(/viewer/i)
    await parentModal.close()
  })

  test('Bob has downgraded Viewer access on both parent and nested folder', async ({
    bobPage,
    bobDrive
  }) => {
    // 1. Bob opens parent folder from Sharings
    await openSharedDrive(bobPage, USERS.bob, bobDrive, PARENT_EDITOR_FOLDER)

    // 2. In parent folder, Bob is now Viewer -> Upload button is disabled
    await expect(bobDrive.uploadButton).toBeDisabled()
    await bobDrive.row(NESTED_EDITOR_FOLDER).waitVisible()

    // 3. Bob navigates into nested folder
    await bobDrive.row(NESTED_EDITOR_FOLDER).open()
    await bobPage.waitForURL(/\/shareddrive\/[^/]+\/[^/]+/)

    // 4. In nested folder, Bob is also Viewer -> Upload button is disabled
    await expect(bobDrive.uploadButton).toBeDisabled()
    await bobPage.goto('about:blank')
  })
})
