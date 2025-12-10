import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import TrashIcon from 'cozy-ui/transpiled/react/Icons/Trash'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { getSharingIdFromRelationships } from '@/modules/shareddrives/helpers'

const LeaveSharedDriveButtonItem = ({ files }) => {
  const { t } = useI18n()
  const client = useClient()
  const navigate = useNavigate()
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
      navigate('/sharings')
    }
  }

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={TrashIcon} className="u-error" />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_leave_shared_drive')} />
    </ActionsMenuItem>
  )
}

export default LeaveSharedDriveButtonItem
