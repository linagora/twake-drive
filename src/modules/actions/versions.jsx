import React, { forwardRef } from 'react'

import { isFile } from 'cozy-client/dist/models/file'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import HistoryIcon from 'cozy-ui/transpiled/react/Icons/History'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModal } from '@/modules/actions/helpers'

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
  Component.displayName = 'Versions'

  return Component
}

export const versions = ({ t, navigate, pathname, isInfected }) => {
  const label = t('SelectionBar.history')
  const icon = HistoryIcon

  return {
    name: 'history',
    label,
    icon,
    displayCondition: selection => {
      return !isInfected && selection.length === 1 && isFile(selection[0])
    },
    action: files => {
      return navigateToModal({ navigate, pathname, files, path: 'revision' })
    },
    Component: makeComponent(label, icon)
  }
}
