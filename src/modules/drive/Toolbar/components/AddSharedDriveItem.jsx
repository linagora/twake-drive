import React from 'react'
import { useDispatch } from 'react-redux'

import { SharedDriveModal } from 'cozy-sharing'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import FileTypeSharedDriveIcon from 'cozy-ui/transpiled/react/Icons/FileTypeSharedDrive'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { showModal } from '@/lib/react-cozy-helpers'

const AddSharedDriveItem = ({ onClick, isReadOnly }) => {
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const dispatch = useDispatch()

  const handleClick = () => {
    if (isReadOnly) {
      showAlert({
        message: t(
          'AddMenu.readOnlyFolder',
          'This is a read-only folder. You cannot perform this action.'
        ),
        severity: 'warning'
      })
      onClick()
      return
    }
    dispatch(showModal(<SharedDriveModal />))
    onClick()
  }

  return (
    <ActionsMenuItem data-testid="add-folder-link" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={FileTypeSharedDriveIcon} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_new_shared_drive')} />
    </ActionsMenuItem>
  )
}

export default AddSharedDriveItem
