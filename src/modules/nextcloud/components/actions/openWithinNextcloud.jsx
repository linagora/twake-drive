import { Icon, LinkOut } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

export const openWithinNextcloud = ({ t }) => {
  const label = t('SelectionBar.openWithinNextcloud')
  const icon = LinkOut

  return {
    name: 'openWithinNextcloud',
    label,
    icon,
    displayCondition: docs => docs.length === 1,
    action: docs => {
      window.open(docs[0].links.self, '_blank')
    },
    Component: forwardRef(function OpenWithinNextcloud(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon></ListItemIcon>
          <ListItemText primary={label} />
          <ListItemIcon>
            <Icon icon={LinkOut} />
          </ListItemIcon>
        </ActionsMenuItem>
      )
    })
  }
}
