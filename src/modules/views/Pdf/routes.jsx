import React from 'react'
import { Navigate, Route } from 'react-router-dom'

import PdfView from '@/modules/views/Pdf'

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
    <Route path="pdf/:fileId" element={<PdfView />} />
    <Route path="pdf/:driveId/:fileId" element={<PdfView />} />
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
        isReadOnly ? <Navigate to="/" replace /> : <PdfView isPublic={true} />
      }
    />
  </>
)
