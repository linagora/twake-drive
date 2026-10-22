import { readFileSync } from 'fs'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { createFile, trashById } from '../helpers/stack'
import { ScribePage } from '../pages/ScribePage'

// Drive's chrome around the scribe plugin, with the assistant of the e2e
// stack. The stack has no LLM: no test waits for an answer of the assistant.

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'scribe')
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// In a runtime kept between runs, the documents would fill the root of the
// Drive
const uploaded: { instance: string; fileId: string }[] = []
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
})
