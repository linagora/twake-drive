import { Icon, Certified } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import flag from 'cozy-flags'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { buildEuDssDeeplink, EU_DSS_VERIFY } from './helpers/euDss'

const makeComponent = (label, icon) => {
  const Component = forwardRef((props, ref) => {
    return (
      <ActionsMenuItem {...props} ref={ref}>
        <ListItemIcon>
          <Icon icon={icon} />
        </ListItemIcon>
        <ListItemText primary={label} />
      </ActionsMenuItem>
    )
  })
  Component.displayName = 'verifyWithEuDss'

  return Component
}

export const verifyWithEuDss = ({
  client,
  t,
  hasWriteAccess,
  isPublic,
  showAlert
}) => {
  const label = t('actions.verifyWithEuDss')
  const icon = Certified

  return {
    name: 'verifyWithEuDss',
    label,
    icon,
    allowMultiple: false,
    allowFolders: false,
    displayCondition: files =>
      flag('drive.verify.enabled') &&
      files.length === 1 &&
      hasWriteAccess &&
      !isPublic,
    action: async files => {
      try {
        const deeplink = await buildEuDssDeeplink(
          client,
          files[0],
          EU_DSS_VERIFY
        )
        window.location.assign(deeplink)
      } catch {
        showAlert({
          message: t('alert.try_again'),
          severity: 'error',
          duration: 4000
        })
      }
    },
    Component: makeComponent(label, icon)
  }
}
