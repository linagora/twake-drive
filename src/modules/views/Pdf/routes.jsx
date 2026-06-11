import React, { Suspense, lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'

import Loader from '@/components/Loader'

// The editor pulls in @embedpdf/react-pdf-viewer (several MB of JS plus the
// Pdfium wasm), so it must stay out of the entry chunks: only visitors who
// actually open a /pdf route should download it.
const PdfView = lazy(() => import('@/modules/views/Pdf'))

const LazyPdfView = props => (
  <Suspense fallback={<Loader />}>
    <PdfView {...props} />
  </Suspense>
)

// The route fragments are returned from plain functions (not components) so that
// React Router's createRoutesFromChildren still sees the <Route> elements
// directly when they are spread into <Routes>.

/**
 * Private (logged-in) PDF editor routes, with or without a shared-drive id.
 *
 * @returns {React.ReactElement}
 */
export const getPdfRoutes = () => (
  <>
    <Route path="pdf/:fileId" element={<LazyPdfView />} />
    <Route path="pdf/:driveId/:fileId" element={<LazyPdfView />} />
  </>
)

/**
 * Public (shared-link) PDF editor route. The share code determines read-only.
 *
 * @param {object} [options]
 * @param {boolean} [options.isReadOnly] - The share grants read-only access
 * @returns {React.ReactElement}
 */
export const getPublicPdfRoutes = ({ isReadOnly = false } = {}) => (
  <>
    <Route
      path="pdf/:fileId"
      // The editor is for editing only: a read-only share must not reach it,
      // even by typing the URL. Send those visitors back to the public viewer.
      element={
        isReadOnly ? <Navigate to="/" replace /> : <LazyPdfView isPublic />
      }
    />
  </>
)
