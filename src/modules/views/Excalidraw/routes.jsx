import React from 'react'
import { Navigate, Route } from 'react-router-dom'

import ExcalidrawView from '@/modules/views/Excalidraw'
import ExcalidrawCreateView from '@/modules/views/Excalidraw/Create'

// The route fragments are returned from plain functions (not components) so that
// React Router's createRoutesFromChildren still sees the <Route> elements
// directly when they are spread into <Routes>.

/**
 * Private (logged-in) Excalidraw routes: open and create, with or without a
 * shared-drive id.
 *
 * @returns {React.ReactElement}
 */
export const getExcalidrawRoutes = () => (
  <>
    <Route path="excalidraw/:fileId" element={<ExcalidrawView />} />
    <Route path="excalidraw/:driveId/:fileId" element={<ExcalidrawView />} />
    <Route
      path="excalidraw/create/:folderId"
      element={<ExcalidrawCreateView />}
    />
    <Route
      path="excalidraw/create/:driveId/:folderId"
      element={<ExcalidrawCreateView />}
    />
  </>
)

/**
 * Public (shared-link) Excalidraw routes. When the shared document is itself an
 * Excalidraw drawing (isShared), the share root redirects to its editor.
 *
 * @param {object} [options]
 * @param {boolean} [options.isReadOnly] - The share grants read-only access
 * @param {boolean} [options.isShared] - The shared document is the drawing
 * @param {object} [options.data] - The shared io.cozy.files document
 * @returns {React.ReactElement}
 */
export const getPublicExcalidrawRoutes = ({
  isReadOnly = false,
  isShared = false,
  data
} = {}) => (
  <>
    <Route
      path="excalidraw/:fileId"
      element={<ExcalidrawView isPublic={true} isReadOnly={isReadOnly} />}
    />
    <Route
      path="excalidraw/create/:folderId"
      element={<ExcalidrawCreateView isPublic={true} />}
    />
    {isShared && (
      <Route
        path="/"
        element={<Navigate to={`excalidraw/${data.id}`} replace />}
      />
    )}
  </>
)
