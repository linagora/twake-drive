import React, { useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import {
  makeOnlyOfficeIconByClass,
  canWriteOfficeDocument
} from '@/modules/views/OnlyOffice/helpers'

const CreateOnlyOfficeItem = ({ fileClass, isReadOnly, onClick }) => {
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

    if (canWriteOfficeDocument()) {
      navigate(
        driveId
          ? `/onlyoffice/create/${driveId}/${_folderId}/${fileClass}`
          : `/onlyoffice/create/${_folderId}/${fileClass}`
      )
    } else {
      navigate(
        driveId
          ? `/onlyoffice/${driveId}/${_folderId}/paywall`
          : `/folder/${_folderId}/paywall`
      )
    }
  }, [
    isReadOnly,
    showAlert,
    t,
    onClick,
    navigate,
    driveId,
    _folderId,
    fileClass
  ])

  const ClassIcon = useMemo(
    () => makeOnlyOfficeIconByClass(fileClass),
    [fileClass]
  )

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={ClassIcon} />
      </ListItemIcon>
      <ListItemText primary={t(`toolbar.menu_onlyOffice.${fileClass}`)} />
    </ActionsMenuItem>
  )
}

export default React.memo(CreateOnlyOfficeItem)
