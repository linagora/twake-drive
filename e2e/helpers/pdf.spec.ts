import { readFile } from 'fs/promises'
import path from 'path'

import { extractPdfText } from './pdf'

it('extracts the original text from the binary PDF fixture', async () => {
  const fixture = await readFile(
    path.resolve(__dirname, '..', 'fixtures', 'onlyoffice-editable.pdf')
  )
  const pdf = await extractPdfText(fixture)

  expect(pdf.pageCount).toBe(1)
  expect(pdf.text).toContain('ORIGINAL-PDF-CONTENT')
})
