import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'
import { useLocation } from 'react-router-dom'

import { navLinkMatch } from '@/modules/navigation/helpers'
import { getNavComponents } from '@/modules/navigation/navComponents'

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
  const pathname = lastClicked ? lastClicked : location.pathname
  const isActive = navLinkMatch(rx, to, pathname)
  const { NavLink: UINavLink } = getNavComponents()
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
