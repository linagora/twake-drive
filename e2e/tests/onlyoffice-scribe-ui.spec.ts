import { readFileSync } from 'fs'
import path from 'path'

import { ensureAppInstalled } from '../helpers/apps'
import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { createFile, trashById } from '../helpers/stack'
import { ScribePage } from '../pages/ScribePage'
import { type Geometry, ScribePluginPage } from '../pages/ScribePluginPage'

// Drive's chrome around the scribe plugin, with the assistant of the e2e
// stack. The stack has no LLM: no test waits for an answer of the assistant.

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'scribe')
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// In a runtime kept between runs, the documents would fill the root of the
// Drive
const uploaded: { instance: string; fileId: string }[] = []
test.beforeAll(() => {
  ensureAppInstalled(
    USERS.alice.instance,
    'assistant',
    'registry://assistant/dev'
  )
  setFlags(USERS.alice.instance, {
    ...DEFAULT_FLAGS,
    'cozy.assistant.enabled': true
  })
})
// The stack merges flags: DEFAULT_FLAGS alone would leave this one on
test.afterAll(() => {
  setFlags(USERS.alice.instance, {
    ...DEFAULT_FLAGS,
    'cozy.assistant.enabled': false
  })
})
test.afterEach(async () => {
  for (const { instance, fileId } of uploaded.splice(0)) {
    await trashById(instance, fileId)
  }
})

const uploadScribeDocument = async (
  instance: string,
  name: string
): Promise<string> => {
  const fileId = await createFile({
    instance,
    name: `Scribe ${stamp()} ${name}`,
    content: readFileSync(path.join(FIXTURE_DIR, name)),
    contentType: DOCX
  })
  uploaded.push({ instance, fileId })
  return fileId
}

test.describe('the scribe of Drive', { tag: '@e2e-scribe' }, () => {
  test('the AI button opens the panel with the assistant', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)

    await scribe.openPanel()
    await expect(scribe.panel()).toBeVisible()
    await expect(scribe.assistantFrame().getByRole('textbox')).toBeVisible({
      timeout: 60_000
    })

    await scribe.closePanel()
    await expect(scribe.panel()).toBeHidden()
  })

  test('a button under the selection opens the scribe', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    const plugin = new ScribePluginPage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)
    await scribe.watchMessages()

    await scribe.selectInEditor('P1@start..P1@end')
    await expect(scribe.selectionButton()).toBeVisible()

    // The keys that end the selection each send a geometry: the button
    // follows the last one
    let geometry: Geometry | null = null
    await expect(async () => {
      geometry = (await plugin.takeGeometry()) ?? geometry
      const frame = await scribe.editorFrame().boundingBox()
      const button = await scribe.selectionButton().boundingBox()
      const disc = await scribe.selectionDiscBox()
      const [endX, endY] = geometry?.selection?.rect.corners[3] ?? []
      if (!frame || !button || !disc || endX === undefined) {
        throw new Error('No geometry of the selection or of its button')
      }
      expect(button.x).toBeGreaterThanOrEqual(frame.x)
      expect(button.y).toBeGreaterThanOrEqual(frame.y)
      expect(button.x + button.width).toBeLessThanOrEqual(frame.x + frame.width)
      expect(button.y + button.height).toBeLessThanOrEqual(
        frame.y + frame.height
      )
      // The disc is 4 px below and right of the end of the selection
      expect(disc.x).toBeGreaterThanOrEqual(frame.x + endX)
      expect(disc.y).toBeGreaterThanOrEqual(frame.y + endY)
      expect(disc.x - (frame.x + endX + 4)).toBeLessThanOrEqual(1)
      expect(disc.y - (frame.y + endY + 4)).toBeLessThanOrEqual(1)
    }).toPass({ timeout: 10_000 })

    // Scrolled above the viewer, then back
    await scribe.scrollEditor(300)
    await expect(scribe.selectionButton()).toBeHidden()
    await scribe.scrollEditor(-300)
    await expect(scribe.selectionButton()).toBeVisible()

    await scribe.selectionButton().click()
    await expect(scribe.panel()).toBeVisible()

    await scribe.selectInEditor('P2@mid')
    await expect(scribe.selectionButton()).toBeHidden()

    // An answer written at the cursor is left selected
    await plugin.applyAnswer('insert', 'Un texte écrit')
    await expect(scribe.selectionButton()).toBeVisible()
    expect((await plugin.takeGeometry())?.selection?.hasText).toBe(true)
  })
})
