import { PDFViewer } from '@embedpdf/react-pdf-viewer'
import React, { useEffect } from 'react'

import Oops from '@/components/Error/Oops'
import Loader from '@/components/Loader'
import {
  PDFIUM_WASM_URL,
  STAMP_MANIFESTS,
  FONT_FALLBACK,
  SNIPPET_FONTS
} from '@/modules/views/Pdf/pdfAssets'
import { usePdfDocument } from '@/modules/views/Pdf/usePdfDocument'

const PdfEditor = ({ file, flushRef, isReadOnly = false, author }) => {
  const { status, url, onReady, flush } = usePdfDocument(file, {
    isReadOnly
  })

  // Expose the save/flush to the toolbar (Save button and the flush-on-back
  // both persist pending changes).
  useEffect(() => {
    if (flushRef) flushRef.current = flush
    return () => {
      if (flushRef) flushRef.current = null
    }
  }, [flush, flushRef])

  if (status === 'loading') return <Loader />
  if (status === 'error' || !url) return <Oops />

  return (
    <div
      className="pdf-editor u-flex u-flex-grow-1 u-w-100"
      // Bound the height so EmbedPDF gets a fixed viewport. Without min-height:0
      // the container grows to the (tall) page stack, which feeds back into the
      // fit-page calculation and zooms the document in without end. (Do not add
      // overflow:hidden here: it breaks EmbedPDF's viewport measurement at mount
      // and the pages never render.)
      style={{ minHeight: 0 }}
    >
      <PDFViewer
        config={{
          src: url,
          // Serve every EmbedPDF runtime asset from our own origin instead of
          // jsDelivr (blocked by the production CSP). See pdfAssets.js.
          wasmUrl: PDFIUM_WASM_URL,
          stamp: { manifests: STAMP_MANIFESTS },
          fontFallback: FONT_FALLBACK,
          fonts: SNIPPET_FONTS,
          // The file lifecycle is owned by Twake Drive (the Save button and back
          // navigation), so opening or closing another document from inside the
          // editor makes no sense. Disable only those two entries of EmbedPDF's
          // document menu and keep the rest (print, export, fullscreen, etc.).
          disabledCategories: ['document-open', 'document-close'],
          theme: { preference: 'system' },
          // Fit the whole page on open. The default 'automatic' mode scales
          // small pages up to fit the width, which looks like an auto-zoom.
          zoom: { defaultZoomLevel: 'fit-page' },
          // Attribute annotations and comments to the current user (instance
          // public_name in private, share recipient name in public).
          annotations: { annotationAuthor: author }
        }}
        onReady={onReady}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default PdfEditor
