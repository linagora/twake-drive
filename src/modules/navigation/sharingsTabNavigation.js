import {
  DEFAULT_SHARINGS_VIEW_ROUTE,
  SHARINGS_VIEW_ROUTE
} from '@/constants/config'
import { getSharingsTabSearch } from '@/modules/navigation/hooks/helpers'

function makeSharingsTabLocation({ currentLocation, targetPathname }) {
  return {
    pathname: targetPathname,
    search: getSharingsTabSearch(
      currentLocation.pathname,
      currentLocation.search
    )
  }
}

function makeSharingsViewLocation({ currentLocation }) {
  const location = makeSharingsTabLocation({
    currentLocation,
    targetPathname: SHARINGS_VIEW_ROUTE
  })

  return location.search ? location : DEFAULT_SHARINGS_VIEW_ROUTE
}

export { makeSharingsTabLocation, makeSharingsViewLocation }
