import { Icon, LinkOut, Share } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const shareNextcloudFile = ({ t }) => {
  const label = t('toolbar.share')
  const icon = Share

  return {
    name: 'share',
    label,
    icon,
    displayCondition: docs => docs.length === 1,
    action: docs => {
      window.open(docs[0].links.self, '_blank')
    },
    Component: forwardRef(function Share(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} />
          </ListItemIcon>
          <ListItemText primary={label} />
          <ListItemIcon>
            <Icon icon={LinkOut} />
          </ListItemIcon>
        </ActionsMenuItem>
      )
    })
  }
}

export { shareNextcloudFile }
