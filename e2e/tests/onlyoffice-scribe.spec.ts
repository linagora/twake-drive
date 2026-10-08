import { readFileSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'

import { ensureAppInstalled } from '../helpers/apps'
import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { DEFAULT_FLAGS, setFlags } from '../helpers/flags'
import type { ScribeModel } from '../helpers/scribeModel'
import { createFile, trashById } from '../helpers/stack'
import {
  ScribePluginPage,
  type ScribeApplied,
  type ScribeContent,
  type SheetModel
} from '../pages/ScribePluginPage'

// The selection cases of the scribe plugin (plugins/onlyoffice-scribe), each
// played on a document as Drive plays them: a text is selected, the plugin
// gives it, then writes an answer in its place or after it. See
// e2e/fixtures/scribe/README.md. SCRIBE_UPDATE=1 writes what the plugin does
// as the expected result.

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'scribe')
const CONTENT_TYPES: Record<string, string> = {
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}
const isUpdate = process.env.SCRIBE_UPDATE === '1'

interface ScribeCase {
  id: string
  selection: string
  // null: the text the plugin gives is the whole case
  answerAction: 'insert' | 'replace' | 'apply' | null
  answer: string | null
  // The keys the user presses once the text is read, before the answer
  keys?: string[]
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
    model: ScribeModel | SheetModel | null
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
    'registry://assistant/stable'
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
      const isSheet = suite.document.endsWith('.xlsx')
      const fileId = await createFile({
        instance: USERS.alice.instance,
        name: `Scribe ${stamp()} ${suite.document}`,
        content: readFileSync(path.join(FIXTURE_DIR, suite.document)),
        contentType: CONTENT_TYPES[path.extname(suite.document)]
      })
      fileIds.push(fileId)
      const scribe = new ScribePluginPage(alicePage)
      await scribe.open(USERS.alice.appUrl, fileId)
      // A case of a workbook reads its sheet, with the selection; the
      // workbook is back as it was opened when all its sheets are
      const read = (): Promise<ScribeModel | SheetModel> =>
        isSheet ? scribe.readSheet() : scribe.read()
      const readState = async (): Promise<unknown> =>
        isSheet ? scribe.readSheets() : (await scribe.read()).blocks
      const initial = await readState()

      for (const scribeCase of suite.cases) {
        await test.step(`${scribeCase.id} ${
          scribeCase.answerAction ?? 'read'
        }`, async () => {
          // Once the editor has sent its changes to the Document Server, it
          // undoes them through the server, a step at a time
          await expect(async () => {
            await scribe.reset()
            expect(await readState()).toEqual(initial)
          }, 'the document is back as it was opened').toPass({
            timeout: 15_000
          })
          await (isSheet
            ? scribe.selectCells(scribeCase.selection)
            : scribe.select(scribeCase.selection))
          const content = await scribe.getContent()
          let model: ScribeModel | SheetModel | null = null
          let applied: ScribeApplied | null = null
          let undone: ScribeModel | null = null
          const isUndone = scribeCase.expected?.undone !== undefined
          if (scribeCase.answerAction) {
            await scribe.press(scribeCase.keys ?? [])
            applied = await scribe.applyAnswer(
              scribeCase.answerAction,
              scribeCase.answer ?? '',
              read
            )
            if (scribeCase.next) {
              await scribe.press(scribeCase.next.keys ?? [])
              applied = await scribe.applyAnswer(
                scribeCase.next.answerAction,
                scribeCase.next.answer
              )
            }
            model = await read()
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

// What a case of a workbook cannot show: the undo, the cells selected while
// the panel is open, a busy editor, and the formulas of another language
test.describe('the scribe plugin in a workbook', () => {
  const XLSX = 'sheet-sales.xlsx'
  const TOTAL_ROW = [
    '|   | A | B | C |',
    '|---|---|---|---|',
    '| 6 | Total | =SUM(B2:B5) | =SUM(C2:C5) |'
  ].join('\n')

  const openWorkbook = async (
    scribe: ScribePluginPage
  ): Promise<void> => {
    const fileId = await createFile({
      instance: USERS.alice.instance,
      name: `Scribe ${stamp()} ${XLSX}`,
      content: readFileSync(path.join(FIXTURE_DIR, XLSX)),
      contentType: CONTENT_TYPES['.xlsx']
    })
    fileIds.push(fileId)
    await scribe.open(USERS.alice.appUrl, fileId)
  }

  test(
    'writes the cells of an answer in one step of the undo',
    { tag: '@e2e-scribe' },
    async ({ alicePage }) => {
      const scribe = new ScribePluginPage(alicePage)
      await openWorkbook(scribe)
      const initial = await scribe.readSheets()
      await scribe.selectCells('Ventes!A1:C5')
      await scribe.getContent()

      // Two columns inserted beside the data, then written
      await scribe.applyAnswer(
        'apply',
        [
          '|   | D | E |',
          '|---|---|---|',
          '| 1 | Progression | Écart |',
          '| 2 | =C2/B2-1 | =C2-B2 |'
        ].join('\n'),
        () => scribe.readSheet()
      )
      expect((await scribe.readSheet()).cells[0]).toEqual([
        'Région',
        'Ventes 2024',
        'Ventes 2025',
        'Progression',
        'Écart',
        '',
        'Objectif'
      ])

      await scribe.undo()
      expect(await scribe.readSheets()).toEqual(initial)
    }
  )

  test(
    'gives other cells selected while its panel is open, not a cell clicked',
    { tag: '@e2e-scribe' },
    async ({ alicePage }) => {
      const scribe = new ScribePluginPage(alicePage)
      await openWorkbook(scribe)
      await scribe.selectCells('Ventes!A1:C5')
      await scribe.getContent()

      await scribe.typeCellName('B2:C3')
      const selection = await scribe.waitForSelection()
      expect(selection?.target).toBe('selection')
      expect(selection?.content).toContain('cells B2:C3')

      // A cell clicked moves the cursor: the cells to work on stay
      await scribe.typeCellName('A4')
      expect(await scribe.waitForSelection()).toBe(null)

      // The answer goes in the cells last given
      await scribe.applyAnswer(
        'apply',
        '|   | B | C |\n|---|---|---|\n| 4 | =SUM(B2:B3) | =SUM(C2:C3) |',
        () => scribe.readSheet()
      )
      // Row 4 holds data: a row is inserted for the answer
      const { cells, formulas } = await scribe.readSheet()
      expect(cells[3].slice(0, 3)).toEqual(['', '2180', '2450'])
      expect(cells[4].slice(0, 3)).toEqual(['Est', '1500', '1420'])
      expect(formulas).toEqual({ B4: '=SUM(B2:B3)', C4: '=SUM(C2:C3)' })
    }
  )

  test(
    'writes an answer once the editor is no more busy',
    { tag: '@e2e-scribe' },
    async ({ alicePage }) => {
      const scribe = new ScribePluginPage(alicePage)
      await openWorkbook(scribe)
      await scribe.selectCells('Ventes!A1:C5')
      await scribe.getContent()

      await scribe.holdEditor(2_000)
      await scribe.applyAnswer('apply', TOTAL_ROW, () => scribe.readSheet())

      const { cells, formulas } = await scribe.readSheet()
      expect(cells[5].slice(0, 3)).toEqual(['Total', '4440', '4780'])
      expect(formulas).toEqual({ B6: '=SUM(B2:B5)', C6: '=SUM(C2:C5)' })
    }
  )

  test(
    'writes English formulas in an editor whose formulas are French',
    { tag: '@e2e-scribe' },
    async ({ alicePage }) => {
      const scribe = new ScribePluginPage(alicePage)
      await scribe.useFormulaLanguage('fr')
      await openWorkbook(scribe)
      await scribe.selectCells('Budget!A1:D5')

      // The assistant reads the formulas in English, as it writes them
      expect((await scribe.getContent()).content).toContain(
        'B5: =SUM(B2:B4)'
      )

      await scribe.applyAnswer(
        'apply',
        [
          '|   | A | B | C |',
          '|---|---|---|---|',
          '| 6 | Moyenne | =ROUND(AVERAGE(B2:B4),1) | =IF(C5>2000,1.5,0) |'
        ].join('\n'),
        () => scribe.readSheet()
      )
      const { cells } = await scribe.readSheet()
      expect(cells[5].slice(0, 3)).toEqual(['Moyenne', '716.7', '1.5'])
    }
  )
})

