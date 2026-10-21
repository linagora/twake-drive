import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  captureRealtimeFrames,
  createAndShareFolderWithBob,
  openFolderInDrive,
  openOwnerFolder,
  openSharedDrive,
  waitForSharingRow
} from '../helpers/sharing'
import { trashByName } from '../helpers/stack'

const PARENT = `Realtime Parent ${stamp()}`
const CHILD = `Realtime Child ${stamp()}`

// Every written folder gets a unique stamped name, so a row appearing on a
// recipient's page can only come from the realtime event carrying that name.
const P_ALICE_DIR = `Alice Parent Write ${stamp()}`
const P_BOB_DIR = `Bob Parent Write ${stamp()}`
const C_BOB_DIR = `Bob Child Write ${stamp()}`
const C_CHARLIE_DIR = `Charlie Child Write ${stamp()}`
const C_ALICE_DIR = `Alice Child Write ${stamp()}`
const C_BOB2_DIR = `Bob Child Write 2 ${stamp()}`

// Second chain with a Viewer recipient: Alice owns VParent shared with Bob as
// Viewer, and shares VParent/VChild with Charlie as Editor.
const VPARENT = `Realtime VParent ${stamp()}`
const VCHILD = `Realtime VChild ${stamp()}`
const VP_ALICE_DIR = `Alice VParent Write ${stamp()}`
const VC_CHARLIE_DIR = `Charlie VChild Write ${stamp()}`
const VC_ALICE_DIR = `Alice VChild Write ${stamp()}`

const REALTIME_TIMEOUT = 30_000

test.describe.serial('Nested shared drive realtime (Alice/Bob/Charlie)', () => {
  test.afterAll(async () => {
    // Child sits inside Parent, so trashing the parent removes both and
    // revokes both sharings.
    await trashByName(USERS.alice.instance, PARENT)
    await trashByName(USERS.alice.instance, VPARENT)
  })

  test('Alice shares Parent, seeded with Child, with Bob as Editor', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, PARENT, {
      role: 'Editor',
      seed: async () => {
        await aliceDrive.createFolder(CHILD)
      }
    })
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, PARENT)
  })

  test('Alice shares Child with Charlie as Editor', async ({
    alicePage,
    aliceDrive,
    charliePage,
    charlieDrive
  }) => {
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, PARENT)
    await aliceDrive.openFolder(CHILD)
    const modal = await aliceDrive.openShareModal()
    await modal.setNewMemberRole('Editor')
    await modal.addMember(USERS.charlie.email)
    await modal.share()

    await waitForSharingRow(charliePage, USERS.charlie, charlieDrive, CHILD)
  })

  test('Writes in Parent reach members in realtime, Charlie receives nothing', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, PARENT)
    await openSharedDrive(bobPage, USERS.bob, bobDrive, PARENT)

    // Charlie's realtime socket must open after the capture begins — a
    // connection that already exists cannot be observed retroactively.
    const charlieRealtime = captureRealtimeFrames(charliePage)
    await charliePage.reload()
    await openSharedDrive(charliePage, USERS.charlie, charlieDrive, CHILD)

    // Owner -> recipient: Alice writes in her own storage, Bob's proxied
    // view must update without any reload.
    await aliceDrive.createFolder(P_ALICE_DIR)
    await expect(bobDrive.row(P_ALICE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })

    // Recipient -> owner: Bob writes through the proxy, Alice's own
    // instance realtime must update her view.
    await bobDrive.createFolder(P_BOB_DIR)
    await expect(aliceDrive.row(P_BOB_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })

    // Anchor the absence checks below: Bob writes into Child and Charlie
    // must see it, proving Charlie's realtime connection is alive and that
    // enough time has elapsed for a Parent event to have been delivered
    // if one were going to be.
    await openFolderInDrive(bobPage, bobDrive, CHILD)

    await bobDrive.createFolder(C_BOB_DIR)
    await expect(charlieDrive.row(C_BOB_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })

    // The capture itself must have carried the Child write, otherwise the
    // Parent absence assertions below would be vacuous.
    const charlieFrames = charlieRealtime.join('\n')
    expect(charlieFrames).toContain(C_BOB_DIR)

    // Neither Parent write may reach Charlie through realtime, even while
    // his Parent sharing row stays absent.
    expect(charlieFrames).not.toContain(P_ALICE_DIR)
    expect(charlieFrames).not.toContain(P_BOB_DIR)

    // And Charlie has no access to Parent at all, so nothing should leak
    // through membership either. goto resolves before the asynchronous
    // sharings query renders, so only trust an absence seen on a list
    // that already shows the Child row Charlie does have.
    await charliePage.goto(`${USERS.charlie.appUrl}/#/sharings`)
    await charlieDrive.row(CHILD).waitVisible({ timeout: 5_000 })
    await expect(charlieDrive.row(PARENT).cell).toHaveCount(0)
  })

  test('Writes in Child reach all three members in realtime', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, PARENT)
    await aliceDrive.openFolder(CHILD)
    await openSharedDrive(bobPage, USERS.bob, bobDrive, PARENT)
    await openFolderInDrive(bobPage, bobDrive, CHILD)
    await openSharedDrive(charliePage, USERS.charlie, charlieDrive, CHILD)

    await charlieDrive.createFolder(C_CHARLIE_DIR)
    await expect(aliceDrive.row(C_CHARLIE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })
    await expect(bobDrive.row(C_CHARLIE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })

    await aliceDrive.createFolder(C_ALICE_DIR)
    await expect(bobDrive.row(C_ALICE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })
    await expect(charlieDrive.row(C_ALICE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })

    await bobDrive.createFolder(C_BOB2_DIR)
    await expect(aliceDrive.row(C_BOB2_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })
    await expect(charlieDrive.row(C_BOB2_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })
  })

  test('Alice shares VParent with Bob as Viewer, then VChild with Charlie as Editor', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    await createAndShareFolderWithBob(alicePage, aliceDrive, VPARENT, {
      role: 'Viewer',
      seed: async () => {
        await aliceDrive.createFolder(VCHILD)
      }
    })
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, VPARENT)

    // A Viewer cannot create a nested shared drive, so the owner shares the
    // child herself.
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, VPARENT)
    await aliceDrive.openFolder(VCHILD)
    const modal = await aliceDrive.openShareModal()
    await modal.setNewMemberRole('Editor')
    await modal.addMember(USERS.charlie.email)
    await modal.share()

    await waitForSharingRow(charliePage, USERS.charlie, charlieDrive, VCHILD)
  })

  test('Writes in VChild reach the Viewer and the nested member in realtime', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive,
    charliePage,
    charlieDrive
  }) => {
    await openSharedDrive(bobPage, USERS.bob, bobDrive, VPARENT)
    await openFolderInDrive(bobPage, bobDrive, VCHILD)
    await openSharedDrive(charliePage, USERS.charlie, charlieDrive, VCHILD)
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, VPARENT)
    await aliceDrive.openFolder(VCHILD)

    await charlieDrive.createFolder(VC_CHARLIE_DIR)
    await expect(bobDrive.row(VC_CHARLIE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })

    await aliceDrive.createFolder(VC_ALICE_DIR)
    await expect(bobDrive.row(VC_ALICE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })
    await expect(charlieDrive.row(VC_ALICE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })
  })

  test('Writes in VParent reach the Viewer in realtime', async ({
    alicePage,
    aliceDrive,
    bobPage,
    bobDrive
  }) => {
    await openOwnerFolder(alicePage, USERS.alice, aliceDrive, VPARENT)
    await openSharedDrive(bobPage, USERS.bob, bobDrive, VPARENT)

    await aliceDrive.createFolder(VP_ALICE_DIR)
    await expect(bobDrive.row(VP_ALICE_DIR).cell).toBeVisible({
      timeout: REALTIME_TIMEOUT
    })
  })
})
