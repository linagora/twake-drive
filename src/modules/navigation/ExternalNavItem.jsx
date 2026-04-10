import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import { useClient, generateWebLink } from 'cozy-client'
import { isFlagshipApp } from 'cozy-device-helper'
import { useWebviewIntent } from 'cozy-intent'
import {
  NavLink as UINavLink,
  NavItem as UINavItem
} from 'cozy-ui/transpiled/react/Nav'
import { useI18n } from 'twake-i18n'

import { NavContent } from '@/modules/navigation/NavContent'

const ExternalNavItem = ({ slug, icon, label, path, clickState }) => {
  const { t } = useI18n()
  const client = useClient()
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
