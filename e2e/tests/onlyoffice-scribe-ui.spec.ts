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
    await expect(scribe.assistantComposer()).toBeVisible({
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
    await expect(scribe.popover()).toBeVisible()

    await scribe.selectInEditor('P2@mid')
    await expect(scribe.selectionButton()).toBeHidden()
    await expect(scribe.popover()).toBeHidden()

    // An answer written at the cursor is left selected
    await plugin.applyAnswer('insert', 'Un texte écrit')
    await expect(scribe.selectionButton()).toBeVisible()
    expect((await plugin.takeGeometry())?.selection?.hasText).toBe(true)
  })

  test('a floating button opens and closes the panel', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)

    await expect(scribe.floatingButton()).toBeVisible()
    // Until the first geometry of the plugin, the button waits in the bottom
    // right corner of the window
    await expect(async () => {
      const frame = await scribe.editorFrame().boundingBox()
      const viewer = await scribe.viewerBox()
      const button = await scribe.floatingButton().boundingBox()
      if (!frame || !viewer || !button) {
        throw new Error('No box of the editor or of the floating button')
      }
      expect(button.x).toBeGreaterThanOrEqual(frame.x)
      expect(button.y).toBeGreaterThanOrEqual(frame.y)
      expect(button.x + button.width).toBeLessThanOrEqual(frame.x + frame.width)
      expect(button.y + button.height).toBeLessThanOrEqual(
        frame.y + frame.height
      )
      // 12 px inside the top right corner of the document area
      expect(Math.abs(button.y - (viewer.y + 12))).toBeLessThanOrEqual(1)
      expect(
        Math.abs(button.x + button.width - (viewer.x + viewer.width - 12))
      ).toBeLessThanOrEqual(1)
    }).toPass({ timeout: 10_000 })

    await scribe.floatingButton().click()
    await expect(scribe.panel()).toBeVisible()
    await scribe.floatingButton().click()
    await expect(scribe.panel()).toBeHidden()
  })

  test('the Assistant tab of the editor opens the scribe', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)

    await scribe.editorTab('Assistant').click()
    await scribe.editorToolbarButton('Scribe panel').click()
    await expect(scribe.panel()).toBeVisible()
    await scribe.editorToolbarButton('Scribe panel').click()
    await expect(scribe.panel()).toBeHidden()

    await scribe.selectInEditor('P1@start..P1@end')
    await scribe.editorToolbarButton('Inline Scribe').click()
    await expect(scribe.popover()).toBeVisible()
    await expect(scribe.intentFrame(scribe.popover())).toBeVisible({
      timeout: 60_000
    })
  })

  test('the Scribe button of the Plugins tab opens the scribe', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)

    await scribe.selectInEditor('P1@start..P1@end')
    await scribe.editorTab('Plugins').click()
    await scribe.editorToolbarButton('Scribe').click()
    await expect(scribe.popover()).toBeVisible()
    await expect(scribe.intentFrame(scribe.popover())).toBeVisible({
      timeout: 60_000
    })
  })

  test('the selection button opens a popover on the selection', async ({
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
    await scribe.watchIntentData()

    await scribe.selectInEditor('P1@start..P1@end')
    await scribe.selectionButton().click()
    await expect(scribe.popover()).toBeVisible()
    await expect(scribe.intentFrame(scribe.popover())).toBeVisible({
      timeout: 60_000
    })
    // The button goes under the popover
    await expect(scribe.selectionButton()).toBeHidden()

    let geometry: Geometry | null = null
    await expect(async () => {
      geometry = (await plugin.takeGeometry()) ?? geometry
      const frame = await scribe.editorFrame().boundingBox()
      const popover = await scribe.popover().boundingBox()
      const rect = geometry?.selection?.rect
      if (!frame || !popover || !rect) {
        throw new Error('No geometry of the selection or of the popover')
      }
      const [endX, endY] = rect.corners[3]
      // 12 px below the selection, from its left edge
      expect(popover.y).toBeGreaterThanOrEqual(frame.y + endY)
      expect(
        Math.abs(popover.y - (frame.y + rect.top + rect.height + 12))
      ).toBeLessThanOrEqual(1)
      expect(Math.abs(popover.x - (frame.x + rect.left))).toBeLessThanOrEqual(1)
      expect(popover.x).toBeLessThanOrEqual(frame.x + endX)
    }).toPass({ timeout: 10_000 })

    await expect
      .poll(() => scribe.receivedIntentData(scribe.popover()), {
        timeout: 60_000
      })
      .toMatchObject({ layout: 'compact', source: 'selection' })

    await scribe.pressEscapeInPage()
    await expect(scribe.popover()).toBeHidden()
    await expect(scribe.selectionButton()).toBeVisible()
  })

  test('a panel request moves the scribe to the panel', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)
    await scribe.watchIntentData()

    await scribe.selectInEditor('P1@start..P1@end')
    await scribe.selectionButton().click()
    await expect(scribe.popover()).toBeVisible()
    const popoverIntentId = await scribe.intentId(scribe.popover())

    await scribe.postIntentResult(scribe.popover(), {
      request: 'panel',
      draft: 'Hello',
      conversation: 'c1'
    })

    await expect(scribe.popover()).toBeHidden()
    await expect(scribe.panel()).toBeVisible()
    await expect
      .poll(() => scribe.receivedIntentData(scribe.panel()), {
        timeout: 60_000
      })
      .toMatchObject({
        layout: 'panel',
        source: 'popover',
        draft: 'Hello',
        conversation: 'c1'
      })
    // A new intent: an open one reads its data at its opening only
    expect(await scribe.intentId(scribe.panel())).not.toBe(popoverIntentId)
  })

  test('the assistant gets the whole document it asks for', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)
    await scribe.watchIntentData()

    await scribe.selectInEditor('P1@start..P1@end')
    await scribe.openPanel()
    await expect(scribe.panel()).toBeVisible()
    await scribe.postIntentResult(scribe.panel(), { request: 'document' })

    await expect
      .poll(() => scribe.receivedIntentData(scribe.panel()), {
        timeout: 15_000
      })
      .toMatchObject({
        documentAvailable: true,
        document:
          'The quick brown fox\n\nJumps over the dog\n\nLazy river flows\n\n',
        documentTruncated: false
      })
  })

  test('the popover is a drawer on a narrow screen', async ({ alicePage }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)

    await scribe.setWindowSize(390, 800)
    await scribe.selectInEditor('P1@start..P1@space')
    await scribe.selectionButton().click()

    await expect(scribe.drawer()).toBeVisible()
    await expect(scribe.popover()).toBeHidden()

    await scribe.swipeDrawerDown(80)
    await expect(scribe.drawer()).toBeHidden()
  })

  // The panel is remembered in the localStorage of the browser context, which
  // each test gets afresh: the whole scenario stays in this test
  test('the panel resizes and stays open', async ({ alicePage }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)

    await scribe.openPanel()
    await expect(scribe.panel()).toBeVisible()
    expect(await scribe.panelWidth()).toBe(400)
    const frame = await scribe.editorFrame().boundingBox()
    if (!frame) throw new Error('No editor frame')

    await scribe.dragHandle(-100)
    await expect(async () => {
      expect(Math.abs((await scribe.panelWidth()) - 500)).toBeLessThanOrEqual(2)
      const resized = await scribe.editorFrame().boundingBox()
      if (!resized) throw new Error('No editor frame')
      expect(Math.abs(frame.width - resized.width - 100)).toBeLessThanOrEqual(2)
    }).toPass({ timeout: 5_000 })

    await scribe.reload()
    await expect(scribe.panel()).toBeVisible()

    await scribe.closePanel()
    await expect(scribe.panel()).toBeHidden()
    await scribe.reload()
    // The panel shows only once the plugin answers, but a restore saves it
    // open as soon as the plugin is ready
    expect(await scribe.isPanelOpenStored()).toBe(false)
    await expect(scribe.panel()).toBeHidden()
  })
})
