import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { getLegacySharingsRoute, getSearchWithoutLegacyTab } from './routes'

export const LegacySharingsRedirect = () => {
  const location = useLocation()

  return (
    <Navigate
      to={{
        pathname: getLegacySharingsRoute(location.pathname),
        search: getSearchWithoutLegacyTab(location.search)
      }}
      replace={true}
    />
  )
}
