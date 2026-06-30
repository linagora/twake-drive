import { Icon, Download } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import { isFile } from 'cozy-client/dist/models/file'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

export const downloadNextcloudFile = ({ t, client }) => {
  const label = t('SelectionBar.download')
  const icon = Download

  return {
    name: 'downloadNextcloudFile',
    label,
    icon,
    displayCondition: docs => {
      return docs.length === 1
    },
    action: docs => {
      return client
        .collection('io.cozy.remote.nextcloud.files')
        .download(docs[0])
    },
    disabled: docs => docs.some(doc => !isFile(doc)),
    Component: forwardRef(function DownloadNextcloudFile(props, ref) {
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
