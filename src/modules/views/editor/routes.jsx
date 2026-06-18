import React from 'react'

import flag from 'cozy-flags'

import { getExcalidrawRoutes } from '@/modules/views/Excalidraw/routes'
import { getOnlyOfficeRoutes } from '@/modules/views/OnlyOffice/routes'
import { getPdfRoutes } from '@/modules/views/Pdf/routes'

/**
 * The in-app document editors and how their routes are mounted. Adding an
 * editor means adding one entry here. A `flag` of `null` mounts the editor
 * unconditionally (it gates access internally); otherwise the routes are only
 * mounted when the flag is enabled.
 *
 * @type {{ slug: string, flag: string|null, getRoutes: () => React.ReactElement }[]}
 */
const EDITOR_ROUTE_GROUPS = [
  { slug: 'onlyoffice', flag: null, getRoutes: getOnlyOfficeRoutes },
  {
    slug: 'excalidraw',
    flag: 'drive.excalidraw.enabled',
    getRoutes: getExcalidrawRoutes
  },
  { slug: 'pdf', flag: 'drive.pdf-editor.enabled', getRoutes: getPdfRoutes }
]

/**
 * Mounts every enabled editor's in-app routes. The route fragments are spread
 * directly (not wrapped in a component) so React Router's
 * createRoutesFromChildren still sees the `<Route>` elements, the same way the
 * per-editor route functions are written.
 *
 * @returns {React.ReactElement}
 */
export const getEditorRoutes = () => (
  <>
    {EDITOR_ROUTE_GROUPS.map(({ slug, flag: editorFlag, getRoutes }) =>
      editorFlag === null || flag(editorFlag) ? (
        <React.Fragment key={slug}>{getRoutes()}</React.Fragment>
      ) : null
    )}
  </>
)
