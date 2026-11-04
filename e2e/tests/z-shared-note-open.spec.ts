import { ensureAppInstalled } from '../helpers/apps'
import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { waitForSharingRow } from '../helpers/sharing'
import { createNote, findDriveSharingIdForFile } from '../helpers/stack'
import { NotesPage } from '../pages/NotesPage'

const ALICE_ROOT = `${USERS.alice.appUrl}/#/folder`

// Shared across .serial tests in this describe — do not enable fullyParallel.
let note: { id: string; name: string }

test.beforeAll(async () => {
  // The recipient is handed to the Notes app of the note's owner.
  ensureAppInstalled(USERS.alice.instance, 'notes', 'registry://notes/stable')
  note = await createNote({
    instance: USERS.alice.instance,
    title: `shared-note-${stamp()}`
  })
})

test.describe.serial('Note shared alone as a shared drive', () => {
  test('Alice shares the note with Bob from the row menu', async ({
    alicePage,
    aliceDrive
  }) => {
    await alicePage.goto(ALICE_ROOT)
    const row = aliceDrive.row(note.name)
    await row.waitVisible()

    const shareModal = await row.share()
    await shareModal.addMember(USERS.bob.email)
    await shareModal.share()

    // Federated sharing of a single file is a file-root shared drive, the
    // shape this spec is about: fail here if the note was shared otherwise.
    await expect(async () => {
      await findDriveSharingIdForFile({
        instance: USERS.alice.instance,
        fileId: note.id
      })
    }).toPass({ timeout: 10_000 })
  })

  test('Bob opens the note in Notes from his Sharings tab', async ({
    bobPage,
    bobDrive
  }) => {
    await waitForSharingRow(bobPage, USERS.bob, bobDrive, note.name)

    await new NotesPage(bobPage).expectOpenedOn(USERS.alice, note.id, () =>
      bobDrive.row(note.name).open()
    )
  })

  test('Bob opens the note in Notes from the invitation e-mail link', async ({
    bobPage
  }) => {
    const driveId = await findDriveSharingIdForFile({
      instance: USERS.alice.instance,
      fileId: note.id
    })

    // The stack redirects the e-mail link to this Drive URL
    // (`DriveTargetURL` for a file-root shared drive).
    await new NotesPage(bobPage).expectOpenedOn(
      USERS.alice,
      note.id,
      async () => {
        await bobPage.goto(
          `${USERS.bob.appUrl}/#/sharings/shareddrive/${driveId}/file/${note.id}`
        )
      }
    )
  })
})
