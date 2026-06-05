import React from 'react'
import { Route } from 'react-router-dom'

import OnlyOfficeView from '@/modules/views/OnlyOffice'
import OnlyOfficeCreateView from '@/modules/views/OnlyOffice/Create'
import OnlyOfficePaywallView from '@/modules/views/OnlyOffice/OnlyOfficePaywallView'

// The route fragment is returned from a plain function (not a component) so that
// React Router's createRoutesFromChildren still sees the <Route> elements
// directly when they are spread into <Routes>.

/**
 * Private (logged-in) OnlyOffice routes: open and create, with or without a
 * shared-drive id, each open route nesting its paywall.
 *
 * @returns {React.ReactElement}
 */
export const getOnlyOfficeRoutes = () => (
  <>
    <Route path="onlyoffice/:fileId" element={<OnlyOfficeView />}>
      <Route path="paywall" element={<OnlyOfficePaywallView />} />
    </Route>
    <Route path="onlyoffice/:driveId/:fileId" element={<OnlyOfficeView />}>
      <Route path="paywall" element={<OnlyOfficePaywallView />} />
    </Route>
    <Route
      path="onlyoffice/create/:folderId/:fileClass"
      element={<OnlyOfficeCreateView />}
    />
    <Route
      path="onlyoffice/create/:driveId/:folderId/:fileClass"
      element={<OnlyOfficeCreateView />}
    />
  </>
)
