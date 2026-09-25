import path from 'path'

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js'

pdfjs.GlobalWorkerOptions.workerSrc =
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.js')
const standardFontDataUrl = path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts/'
)

/** Extract text from actual PDF pages, including compressed content streams. */
export async function extractPdfText(bytes: Buffer): Promise<{
  pageCount: number
  text: string
}> {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl
  })
  try {
    const document = await loadingTask.promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(
        content.items
          .flatMap(item => ('str' in item ? [item.str] : []))
          .join(' ')
      )
    }
    return { pageCount: document.numPages, text: pages.join('\n') }
  } finally {
    await loadingTask.destroy()
  }
}
