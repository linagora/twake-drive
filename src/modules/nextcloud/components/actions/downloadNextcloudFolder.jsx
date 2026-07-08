import { Icon, Download } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const downloadNextcloudFolder = ({ t }) => {
  const label = t('toolbar.menu_download_folder')
  const icon = Download

  return {
    name: 'downloadNextcloudFolder',
    label,
    icon,
    action: () => {},
    disabled: () => true,
    Component: forwardRef(function DownloadNextcloudFolder(props, ref) {
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

export { downloadNextcloudFolder }
