import { Icon, MultiFiles } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import { isFile } from 'cozy-client/dist/models/file'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const duplicateNextcloudFile = ({ t }) => {
  const label = t('SelectionBar.duplicate')
  const icon = MultiFiles

  return {
    name: 'duplicateNextcloudFile',
    label,
    icon,
    displayCondition: selection => {
      return selection.length === 1 && isFile(selection[0])
    },
    action: () => {},
    disabled: () => true,
    Component: forwardRef(function Duplicate(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} />
          </ListItemIcon>
          <ListItemText primary={label} />
        </ActionsMenuItem>
      )
    })
  }
}

export { duplicateNextcloudFile }
