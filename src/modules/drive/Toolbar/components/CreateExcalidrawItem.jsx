import React, { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import ExcalidrawIcon from '@/assets/icons/icon-excalidraw.svg'
import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'

const CreateExcalidrawItem = ({ isReadOnly, onClick }) => {
  const { folderId = ROOT_DIR_ID, driveId = undefined } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { showAlert } = useAlert()

  const _folderId = folderId === TRASH_DIR_ID ? ROOT_DIR_ID : folderId

  const handleClick = useCallback(() => {
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

    navigate(
      driveId
        ? `/excalidraw/create/${driveId}/${_folderId}`
        : `/excalidraw/create/${_folderId}`
    )
  }, [isReadOnly, showAlert, t, onClick, navigate, driveId, _folderId])

  return (
    <ActionsMenuItem data-testid="create-an-excalidraw" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={ExcalidrawIcon} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_create_excalidraw')} />
    </ActionsMenuItem>
  )
}

export default React.memo(CreateExcalidrawItem)
