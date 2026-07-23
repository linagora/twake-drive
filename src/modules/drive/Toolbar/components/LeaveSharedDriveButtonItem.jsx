import { Icon, Logout } from '@linagora/twake-icons'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useClient } from 'cozy-client'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { getSharingIdFromRelationships } from '@/modules/shareddrives/helpers'
import { getSharingsRootRoute } from '@/modules/views/Sharings/routes'

const LeaveSharedDriveButtonItem = ({ files }) => {
  const { t } = useI18n()
  const client = useClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { showAlert } = useAlert()
  const handleClick = async () => {
    const file = files[0]
    const sharingId = getSharingIdFromRelationships(file)
    if (sharingId) {
      await client.collection('io.cozy.sharings').revokeSelf({ _id: sharingId })
      showAlert({
        message: t('Files.share.revokeSelf.success'),
        severity: 'success'
      })
      navigate(getSharingsRootRoute(pathname))
    }
  }

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={Logout} className="u-error" />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_leave_shared_drive')} />
    </ActionsMenuItem>
  )
}

export default LeaveSharedDriveButtonItem
