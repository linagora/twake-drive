import React, { forwardRef } from 'react'

import flag from 'cozy-flags'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import InfoOutlinedIcon from 'cozy-ui/transpiled/react/Icons/InfoOutlined'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

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

  Component.displayName = 'details'

  return Component
}

export const details = ({ t, navigate, location }) => {
  const icon = InfoOutlinedIcon
  const label = t('actions.details')

  return {
    name: 'details',
    icon,
    label,
    allowInfectedFiles: false,
    displayCondition: () =>
      flag('drive.new-file-viewer-ui.enabled') &&
      location?.state?.showDetailPanel === false,
    Component: makeComponent(label, icon),
    action: () => {
      navigate(location.pathname, {
        replace: true,
        state: {
          ...location.state,
          showDetailPanel: true
        }
      })
    }
  }
}
