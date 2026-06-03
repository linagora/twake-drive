import React, { forwardRef } from 'react'

import { isFile } from 'cozy-client/dist/models/file'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import InfoIcon from 'cozy-ui/transpiled/react/Icons/Info'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import {
  isFileRootSharedDrive,
  navigateToFileRootViewer
} from '@/modules/shareddrives/rootFileNavigation'

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

  Component.displayName = 'infos'

  return Component
}

export const infos = ({ t, isMobile, navigate, pathname = '' }) => {
  const icon = InfoIcon
  const label = isMobile ? t('actions.infosMobile') : t('actions.infos')

  return {
    name: 'infos',
    icon,
    label,
    displayCondition: docs => docs.length <= 1 && isFile(docs[0]),
    Component: makeComponent(label, icon),
    action: docs => {
      if (isFileRootSharedDrive(docs[0])) {
        navigateToFileRootViewer({ navigate, file: docs[0], pathname })
        return
      }

      navigate(`file/${docs[0]._id}`)
    }
  }
}
