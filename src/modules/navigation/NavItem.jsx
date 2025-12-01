import PropTypes from 'prop-types'
import React from 'react'

import { NavItem as UINavItem } from 'cozy-ui/transpiled/react/Nav'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { NavContent } from '@/modules/navigation/NavContent'
import { NavLink } from '@/modules/navigation/NavLink'

/**
 * Renders a navigation item with optional badge content and support for shared links.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {string} [props.to] - The path to navigate to when the item is clicked.
 * @param {string|Object} [props.icon] - The icon to display next to the label.
 * @param {string} [props.label] - The text label for the navigation item.
 * @param {string} [props.forcedLabel] - The forced text label for the navigation item (optional).
 * @param {RegExp} [props.rx] - A RegExp to modify the path dynamically (optional).
 * @param {Object} [props.clickState] - State to be passed to the NavLink on click (optional).
 * @param {number} [props.badgeContent] - Content of the badge to display (optional).
 * @param {boolean} [props.secondary=false] - Whether to apply secondary styling to the nav item (optional).
 * @returns {JSX.Element} The rendered navigation item component.
 */
const NavItem = ({
  to,
  icon,
  label,
  rx,
  clickState,
  badgeContent,
  secondary,
  forcedLabel
}) => {
  const { t } = useI18n()

  return (
    <UINavItem secondary={secondary}>
      <NavLink to={to} rx={rx} clickState={clickState}>
        <NavContent
          icon={icon}
          label={forcedLabel ?? t(`Nav.item_${label}`)}
          badgeContent={badgeContent}
        />
      </NavLink>
    </UINavItem>
  )
}

NavItem.propTypes = {
  to: PropTypes.string,
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  label: PropTypes.string,
  forcedLabel: PropTypes.string,
  rx: PropTypes.shape(RegExp),
  badgeContent: PropTypes.number
}

export { NavItem }
