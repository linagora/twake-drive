import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { getLegacySharingsRoute } from './routes'

export const LegacySharingsRedirect = () => {
  const location = useLocation()

  return (
    <Navigate
      to={{
        pathname: getLegacySharingsRoute(location.pathname),
        search: location.search
      }}
      replace={true}
    />
  )
}
