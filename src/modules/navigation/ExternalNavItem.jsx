import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import { useClient, generateWebLink } from 'cozy-client'
import { isFlagshipApp } from 'cozy-device-helper'
import { useWebviewIntent } from 'cozy-intent'
import { useI18n } from 'twake-i18n'

import { NavContent } from '@/modules/navigation/NavContent'
import { getNavComponents } from '@/modules/navigation/navComponents'

const ExternalNavItem = ({ slug, icon, label, path, clickState }) => {
  const { t } = useI18n()
  const client = useClient()
  const { NavLink: UINavLink, NavItem: UINavItem } = getNavComponents()
  const webviewIntent = useWebviewIntent()

  const href = generateWebLink({
    slug,
    cozyUrl: client.getStackClient().uri,
    subDomainType: client.getInstanceOptions().subdomain,
    ...(path && { hash: path })
  })

  const handleClick = useCallback(
    e => {
      e.preventDefault()
      if (clickState) {
        clickState[1](undefined)
      }
      if (isFlagshipApp()) {
        webviewIntent.call('openApp', href, { slug })
      } else {
        window.location.href = href
      }
    },
    [href, slug, webviewIntent, clickState]
  )

  return (
    <UINavItem>
      <a href={href} onClick={handleClick} className={UINavLink.className}>
        <NavContent icon={icon} label={t(`Nav.item_${label}`)} />
      </a>
    </UINavItem>
  )
}

ExternalNavItem.propTypes = {
  slug: PropTypes.string.isRequired,
  icon: PropTypes.element.isRequired,
  label: PropTypes.string.isRequired,
  path: PropTypes.string,
  clickState: PropTypes.array
}

export { ExternalNavItem }
