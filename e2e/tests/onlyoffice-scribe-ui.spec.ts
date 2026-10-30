import { readFileSync } from 'fs'
import path from 'path'

import { ensureAppInstalled } from '../helpers/apps'
import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import { createFile, trashById } from '../helpers/stack'
import { ScribePage, type Box } from '../pages/ScribePage'
import {
  type Geometry,
  type ScribeApplied,
  ScribePluginPage
} from '../pages/ScribePluginPage'

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

// Throws while the box is not laid out yet, for `toPass` to try again
const ensureBox = (box: Box | null, name: string): Box => {
  if (box === null) throw new Error(`No box of ${name}`)
  return box
}

const expectInside = (box: Box, frame: Box): void => {
  expect(box.x).toBeGreaterThanOrEqual(frame.x)
  expect(box.y).toBeGreaterThanOrEqual(frame.y)
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width)
  expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height)
}

interface ScribeCase {
  id: string
  selection: string
  answerAction: 'insert' | 'replace'
  answer: string
  expected: { applied: ScribeApplied }
}

// A case of the plugin spec, played through Drive's chrome
const findScribeCase = (casesName: string, id: string): ScribeCase => {
  const { cases } = JSON.parse(
    readFileSync(path.join(FIXTURE_DIR, casesName), 'utf-8')
  ) as { cases: ScribeCase[] }
  const found = cases.find(scribeCase => scribeCase.id === id)
  if (!found) throw new Error(`No case ${id} in ${casesName}`)
  return found
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
      const end = geometry?.selection?.rect.corners[3]
      if (!end) throw new Error('No geometry of the selection')
      const [endX, endY] = end
      const frame = ensureBox(
        await scribe.editorFrame().boundingBox(),
        'the editor'
      )
      expectInside(
        ensureBox(await scribe.selectionButton().boundingBox(), 'the button'),
        frame
      )
      const disc = ensureBox(await scribe.selectionDiscBox(), 'the disc')
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
    await expect(scribe.panel()).toBeVisible()

    // An answer written at the cursor is left selected: its button waits
    // for the panel to close
    await plugin.applyAnswer('insert', 'Un texte écrit')
    await expect
      .poll(async () => (await plugin.takeGeometry())?.selection?.hasText)
      .toBe(true)
    await expect(scribe.selectionButton()).toBeHidden()
    await scribe.closePanel()
    await expect(scribe.selectionButton()).toBeVisible()
  })

  test('a floating button opens the panel, and waits for it to close', async ({
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
      const frame = ensureBox(
        await scribe.editorFrame().boundingBox(),
        'the editor'
      )
      const viewer = ensureBox(await scribe.viewerBox(), 'the viewer')
      const button = ensureBox(
        await scribe.floatingButton().boundingBox(),
        'the floating button'
      )
      expectInside(button, frame)
      // 12 px inside the top right corner of the document area
      expect(Math.abs(button.y - (viewer.y + 12))).toBeLessThanOrEqual(1)
      expect(
        Math.abs(button.x + button.width - (viewer.x + viewer.width - 12))
      ).toBeLessThanOrEqual(1)
    }).toPass({ timeout: 10_000 })

    await scribe.floatingButton().click()
    await expect(scribe.panel()).toBeVisible()
    await expect(scribe.floatingButton()).toBeHidden()
    await scribe.closePanel()
    await expect(scribe.panel()).toBeHidden()
    await expect(scribe.floatingButton()).toBeVisible()
  })

  test('the Assistant tab of the editor opens and closes the panel', async ({
    alicePage
  }) => {
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'a-family.docx'
    )
    const scribe = new ScribePage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)

    await scribe.editorTab('Assistant').click()
    await scribe.editorToolbarButton('Scribe Panel').click()
    await expect(scribe.panel()).toBeVisible()
    await scribe.editorToolbarButton('Scribe Panel').click()
    await expect(scribe.panel()).toBeHidden()
    await expect(scribe.editorToolbarButton('Inline Scribe')).toHaveCount(0)
  })

  test('the Scribe button of the Plugins tab opens and closes the panel', async ({
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
    await expect(scribe.panel()).toBeVisible()
    await expect(scribe.intentFrame(scribe.panel())).toBeVisible({
      timeout: 60_000
    })
    await scribe.editorToolbarButton('Scribe').click()
    await expect(scribe.panel()).toBeHidden()
  })

  // Two assistants in one page would reject the messages of each other in
  // cozy-interapp ("Invalid event id"): the panel keeps its intent, which
  // follows the selection
  test('the selection button opens the panel, which follows the selection', async ({
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
    await expect(scribe.panel()).toBeVisible()
    await expect
      .poll(() => scribe.receivedIntentData(scribe.panel()), {
        timeout: 60_000
      })
      .toMatchObject({
        source: 'selection',
        content: expect.stringContaining('The quick brown fox')
      })
    const intentId = await scribe.intentId(scribe.panel())

    // As a user does: the composer of the open panel has the focus
    await scribe.editorFrame().click()
    await scribe.selectInEditor('P2@start..P2@end')
    await expect(scribe.selectionButton()).toBeHidden()

    await expect
      .poll(() => scribe.receivedIntentData(scribe.panel()), {
        timeout: 15_000
      })
      .toMatchObject({
        content: expect.stringContaining('Jumps over the dog')
      })
    expect(await scribe.intentId(scribe.panel())).toBe(intentId)
    await expect(scribe.intentFrames()).toHaveCount(1)
    await expect(scribe.intentIdError()).toHaveCount(0)
  })

  test('the panel tells how many selected cells an answer left', async ({
    alicePage
  }) => {
    // Its answer has a cell for one of the two selected cells
    const { selection, answerAction, answer, expected } = findScribeCase(
      'table-plain.cases.json',
      'T11'
    )
    expect(expected.applied.skippedCells).toBe(1)
    const fileId = await uploadScribeDocument(
      USERS.alice.instance,
      'table-plain.docx'
    )
    const scribe = new ScribePage(alicePage)
    const plugin = new ScribePluginPage(alicePage)
    await scribe.openDocument(USERS.alice.appUrl, fileId)
    await scribe.watchIntentData()

    // Ended with keys, as by ScribePage.selectInEditor, this selection loses
    // its cells: the plugin reads the selection of the API as it is
    await plugin.select(selection)
    await scribe.openPanel()
    await expect(scribe.panel()).toBeVisible()
    await expect(scribe.skippedCellsNotice(scribe.panel())).toBeHidden()
    await scribe.postIntentResult(scribe.panel(), {
      answerAction,
      text: answer,
      format: 'markdown'
    })

    await expect(scribe.skippedCellsNotice(scribe.panel())).toHaveText(
      'Table: 1 selected cell was left unchanged',
      { timeout: 15_000 }
    )

    await scribe.closeSkippedCellsNotice(scribe.panel())
    await expect(scribe.skippedCellsNotice(scribe.panel())).toBeHidden()
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
