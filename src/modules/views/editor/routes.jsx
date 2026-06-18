import React from 'react'

import flag from 'cozy-flags'

import { getExcalidrawRoutes } from '@/modules/views/Excalidraw/routes'
import { getOnlyOfficeRoutes } from '@/modules/views/OnlyOffice/routes'
import { getPdfRoutes } from '@/modules/views/Pdf/routes'
import { EDITORS } from '@/modules/views/editor/registry'

// Each editor's route fragment is keyed by slug. The components stay out of the
// registry (which is imported by the pure dispatch helpers) so they aren't
// pulled into that module's dependency graph and its import-time side effects.
const ROUTE_FACTORIES = {
  excalidraw: getExcalidrawRoutes,
  onlyoffice: getOnlyOfficeRoutes,
  pdf: getPdfRoutes
}

/**
 * Mounts every editor's in-app routes, gated by the editor's `flag` from the
 * registry (`null` mounts unconditionally). The route fragments are spread
 * directly (not wrapped in a component) so React Router's
 * createRoutesFromChildren still sees the `<Route>` elements.
 *
 * @returns {React.ReactElement}
 */
export const getEditorRoutes = () => (
  <>
    {EDITORS.map(({ slug, flag: editorFlag }) =>
      editorFlag === null || flag(editorFlag) ? (
        <React.Fragment key={slug}>{ROUTE_FACTORIES[slug]()}</React.Fragment>
      ) : null
    )}
  </>
)
