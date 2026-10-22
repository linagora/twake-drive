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
