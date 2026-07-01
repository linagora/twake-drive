import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useEffect } from 'react'
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
  isActive,
  clickState: [lastClicked, setLastClicked]
}) => {
  const location = useLocation()
  const pathname = lastClicked ? lastClicked : location.pathname
  const active = isActive ? isActive(pathname) : navLinkMatch(rx, to, pathname)

  useEffect(() => {
    setLastClicked(undefined)
  }, [location.pathname, setLastClicked])

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
        active ? UINavLink.activeClassName : null
      )}
    >
      {children}
    </a>
  )
}

NavLink.propTypes = {
  children: PropTypes.node.isRequired,
  to: PropTypes.string,
  rx: PropTypes.shape(RegExp),
  isActive: PropTypes.func
}

export { NavLink }
