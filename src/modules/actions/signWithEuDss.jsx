import React, { forwardRef } from 'react'

import flag from 'cozy-flags'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import PenIcon from 'cozy-ui/transpiled/react/Icons/Pen'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { buildEuDssDeeplink, EU_DSS_SIGN } from './helpers/euDss'

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
  Component.displayName = 'signWithEuDss'

  return Component
}

export const signWithEuDss = ({
  client,
  t,
  hasWriteAccess,
  isPublic,
  showAlert
}) => {
  const label = t('actions.signWithEuDss')
  const icon = PenIcon

  return {
    name: 'signWithEuDss',
    label,
    icon,
    allowMultiple: false,
    allowFolders: false,
    displayCondition: files =>
      flag('drive.sign.enabled') &&
      files.length === 1 &&
      hasWriteAccess &&
      !isPublic,
    action: async files => {
      try {
        const deeplink = await buildEuDssDeeplink(client, files[0], EU_DSS_SIGN)
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
