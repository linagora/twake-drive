import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { NavLink as UINavLink } from 'cozy-ui/transpiled/react/Nav'

import { navLinkMatch } from '@/modules/navigation/helpers'

/**
 * Like react-router NavLink but sets the lastClicked state (passed in props)
 * to have a faster change of active (not waiting for the route to completely
 * change).
 */
const NavLink = ({
  children,
  to,
  rx,
  clickState: [lastClicked, setLastClicked]
}) => {
  const location = useLocation()
  const prevPathnameRef = useRef(location.pathname)

  useEffect(() => {
    const prevPathname = prevPathnameRef.current
    prevPathnameRef.current = location.pathname

    if (!lastClicked) return

    if (navLinkMatch(rx, lastClicked, location.pathname)) {
      setLastClicked(null) // route arrived at destination
    } else if (location.pathname !== prevPathname) {
      setLastClicked(null) // route changed but went elsewhere (e.g. back button)
    }
  }, [location.pathname, rx, lastClicked, setLastClicked])

  const pathname = lastClicked ? lastClicked : location.pathname
  const isActive = navLinkMatch(rx, to, pathname)
  return (
    <a
      style={{ outline: 'none' }}
      onClick={e => {
        if (!to) e.preventDefault()
        setLastClicked(to)
      }}
      href={`#${to}`}
      className={cx(
        UINavLink.className,
        isActive ? UINavLink.activeClassName : null
      )}
    >
      {children}
    </a>
  )
}

NavLink.propTypes = {
  children: PropTypes.node.isRequired,
  to: PropTypes.string,
  rx: PropTypes.shape(RegExp)
}

export { NavLink }
