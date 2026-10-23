import { readFileSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'

import type { Page } from '@playwright/test'

import { ensureAppInstalled } from '../helpers/apps'
import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import type { ScribeModel, ScribeTable } from '../helpers/scribeModel'
import { createFile, trashById } from '../helpers/stack'
import {
  ScribePluginPage,
  type ScribeApplied,
  type ScribeContent
} from '../pages/ScribePluginPage'

// The selection cases of the scribe plugin (plugins/onlyoffice-scribe), each
// played on a document as Drive plays them: a text is selected, the plugin
// gives it, then writes an answer in its place or after it. See
// e2e/fixtures/scribe/README.md. SCRIBE_UPDATE=1 writes what the plugin does
// as the expected result.

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'scribe')
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const isUpdate = process.env.SCRIBE_UPDATE === '1'

interface ScribeCase {
  id: string
  selection: string
  // null: the text the plugin gives is the whole case
  answerAction: 'insert' | 'replace' | null
  answer: string | null
  // The next answer of the conversation, written over the first one, left
  // selected, without the text being read again; the keys the user presses
  // before, as an undo and a redo
  next?: {
    answerAction: 'insert' | 'replace'
    answer: string
    keys?: string[]
  }
  expected?: {
    content: ScribeContent
    model: ScribeModel | null
    // What the plugin tells Drive once it has written the answer
    applied?: ScribeApplied | null
    // The document after one undo of the answer
    undone?: ScribeModel | null
  }
}

// Indented JSON, with what fits in 100 characters on a single line: a run, a
// short paragraph, a cell position
const stringify = (value: unknown, indent = ''): string => {
  const line = JSON.stringify(value)
  if (typeof value !== 'object' || value === null) return line
  if (line.length <= 100) return line
  const inner = `${indent}  `
  const items = Array.isArray(value)
    ? value.map(item => stringify(item, inner))
    : Object.entries(value).map(
        ([key, item]) => `${JSON.stringify(key)}: ${stringify(item, inner)}`
      )
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  return `${open}\n${inner}${items.join(`,\n${inner}`)}\n${indent}${close}`
}

const suites = readdirSync(FIXTURE_DIR)
  .filter(name => name.endsWith('.cases.json'))
  .map(name => ({
    file: path.join(FIXTURE_DIR, name),
    ...(JSON.parse(readFileSync(path.join(FIXTURE_DIR, name), 'utf-8')) as {
      document: string
      cases: ScribeCase[]
    })
  }))

// The documents go to the trash after their test: in a runtime kept between
// runs, they would fill the root of the Drive of Alice
const fileIds: string[] = []
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
  for (const fileId of fileIds.splice(0)) {
    await trashById(USERS.alice.instance, fileId)
  }
})

for (const suite of suites) {
  test(
    `the scribe plugin reads and writes ${suite.document}`,
    { tag: '@e2e-scribe' },
    async ({ alicePage }) => {
      test.setTimeout(60_000 + suite.cases.length * 20_000)
      const fileId = await createFile({
        instance: USERS.alice.instance,
        name: `Scribe ${stamp()} ${suite.document}`,
        content: readFileSync(path.join(FIXTURE_DIR, suite.document)),
        contentType: DOCX
      })
      fileIds.push(fileId)
      const scribe = new ScribePluginPage(alicePage)
      await scribe.open(USERS.alice.appUrl, fileId)
      const { blocks } = await scribe.read()

      for (const scribeCase of suite.cases) {
        await test.step(`${scribeCase.id} ${
          scribeCase.answerAction ?? 'read'
        }`, async () => {
          // Once the editor has sent its changes to the Document Server, it
          // undoes them through the server, a step at a time
          await expect(async () => {
            await scribe.reset()
            expect((await scribe.read()).blocks).toEqual(blocks)
          }, 'the document is back as it was opened').toPass({
            timeout: 15_000
          })
          await scribe.select(scribeCase.selection)
          const content = await scribe.getContent()
          let model: ScribeModel | null = null
          let applied: ScribeApplied | null = null
          let undone: ScribeModel | null = null
          const isUndone = scribeCase.expected?.undone !== undefined
          if (scribeCase.answerAction) {
            applied = await scribe.applyAnswer(
              scribeCase.answerAction,
              scribeCase.answer ?? ''
            )
            if (scribeCase.next) {
              await scribe.press(scribeCase.next.keys ?? [])
              applied = await scribe.applyAnswer(
                scribeCase.next.answerAction,
                scribeCase.next.answer
              )
            }
            model = await scribe.read()
            if (isUndone) {
              await scribe.undo()
              undone = await scribe.read()
            }
          }
          const result = {
            content,
            model,
            ...(scribeCase.expected?.applied !== undefined && { applied }),
            ...(isUndone && { undone })
          }
          if (isUpdate) {
            scribeCase.expected = result
            return
          }
          expect.soft(result).toEqual(scribeCase.expected)
        })
      }

      if (isUpdate) {
        const { file, ...data } = suite
        writeFileSync(file, `${stringify(data)}\n`)
      }
    }
  )
}

const openScribeDocument = async (
  page: Page,
  name: string
): Promise<ScribePluginPage> => {
  const fileId = await createFile({
    instance: USERS.alice.instance,
    name: `Scribe ${stamp()} ${name}`,
    content: readFileSync(path.join(FIXTURE_DIR, name)),
    contentType: DOCX
  })
  fileIds.push(fileId)
  const scribe = new ScribePluginPage(page)
  await scribe.open(USERS.alice.appUrl, fileId)
  return scribe
}

test(
  'the scribe plugin gives the whole document on request',
  { tag: '@e2e-scribe' },
  async ({ alicePage }) => {
    const scribe = await openScribeDocument(alicePage, 'a-family.docx')
    // Without a selection, the text the plugin gives is the whole document
    await scribe.select('P1@start')
    const whole = await scribe.getContent()
    expect(whole.target).toBe('document')

    await scribe.select('P1@start..P1@end')
    const selected = await scribe.read()
    expect(selected.selText).toContain('The quick brown fox')

    expect(await scribe.getDocument()).toBe(whole.content)
    const { selText, selMarkup } = await scribe.read()
    expect({ selText, selMarkup }).toEqual({
      selText: selected.selText,
      selMarkup: selected.selMarkup
    })

    // A cursor stays where it is: a key typed then goes there
    await scribe.select('P2@mid')
    expect(await scribe.getDocument()).toBe(whole.content)
    await scribe.press(['X'])
    const { blocks } = await scribe.read()
    expect(blocks[1]).toEqual({
      type: 'p',
      runs: [{ t: 'Jumps oveXr the dog' }]
    })
  }
)

test(
  'the scribe plugin keeps cells and a cursor in a cell as it gives the document',
  { tag: '@e2e-scribe' },
  async ({ alicePage }) => {
    const scribe = await openScribeDocument(alicePage, 'table-plain.docx')
    await scribe.select('P1@start')
    const whole = await scribe.getContent()

    await scribe.select('T1.C(0,0)@start..T1.C(0,1)@end')
    const selected = await scribe.read()
    // A selection of cells is drawn over the whole cells
    const bounds = await scribe.selectionBounds()
    expect(await scribe.getDocument()).toBe(whole.content)
    const { selText, selMarkup } = await scribe.read()
    expect({ selText, selMarkup }).toEqual({
      selText: selected.selText,
      selMarkup: selected.selMarkup
    })
    expect(await scribe.selectionBounds()).toEqual(bounds)

    await scribe.select('T1.C(1,1)@3')
    expect(await scribe.getDocument()).toBe(whole.content)
    await scribe.press(['X'])
    const table = (await scribe.read()).blocks[1] as ScribeTable
    expect(table.grid[1][1].blocks[0]).toEqual({
      type: 'p',
      runs: [{ t: 'DelXta' }]
    })
  }
)

test(
  'the scribe plugin keeps a selected image and a cursor in a shape as it gives the document',
  { tag: '@e2e-scribe' },
  async ({ alicePage }) => {
    const scribe = await openScribeDocument(alicePage, 'img-anchor.docx')
    await scribe.select('P1@start')
    const whole = await scribe.getContent()

    await scribe.selectDrawing(0)
    expect(await scribe.countSelectedDrawings()).toBe(1)
    expect(await scribe.getDocument()).toBe(whole.content)
    expect(await scribe.countSelectedDrawings()).toBe(1)

    // The editor's Markdown leaves the text of a shape out
    await scribe.placeCursorInShape('Hello shape', 3)
    expect(await scribe.getDocument()).toBe(whole.content)
    await scribe.press(['X'])
    expect(await scribe.readShapeText()).toBe('HelXlo shape')
  }
)
