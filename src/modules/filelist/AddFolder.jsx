import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import { AddFolderCard } from '@/modules/filelist/AddFolderCard'
import { AddFolderRow } from '@/modules/filelist/AddFolderRow'
import {
  isTypingNewFolderName,
  hideNewFolderInput,
  isEncryptedFolder
} from '@/modules/filelist/duck'
import AddFolderRowVz from '@/modules/filelist/virtualized/AddFolderRow'
import { createFolder } from '@/modules/navigation/duck'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

export const AddFolder = ({
  visible,
  isEncrypted,
  onSubmit,
  onAbort,
  extraColumns
}) => {
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const { isMobile } = useBreakpoints()
  const { viewType } = useViewSwitcherContext()

  if (!visible) {
    return null
  }

  const Comp =
    viewType === 'grid'
      ? AddFolderCard
      : flag('drive.virtualization.enabled') && !isMobile
      ? AddFolderRowVz
      : AddFolderRow

  return (
    <Comp
      isEncrypted={isEncrypted}
      onSubmit={name => onSubmit(name, showAlert, t)}
      onAbort={accidental => onAbort(accidental, showAlert, t)}
      extraColumns={extraColumns}
    />
  )
}

const AddFolderWithState = ({
  vaultClient,
  currentFolderId,
  driveId,
  extraColumns,
  afterSubmit,
  afterAbort,
  addItems
}) => {
  const client = useClient()
  const dispatch = useDispatch()
  const visible = useSelector(isTypingNewFolderName)
  const isEncrypted = useSelector(isEncryptedFolder)

  const onSubmit = (name, showAlert, t) =>
    dispatch(async dispatch =>
      dispatch(
        createFolder(
          client,
          vaultClient,
          name,
          currentFolderId,
          {
            isEncryptedFolder: isEncrypted,
            showAlert,
            t
          },
          driveId,
          addItems
        )
      ).then(() => {
        afterSubmit?.() // eslint-disable-line promise/always-return
      })
    )

  const onAbort = (accidental, showAlert, t) => {
    if (accidental) {
      showAlert({
        message: t('alert.folder_abort'),
        severity: 'secondary',
        noClickAway: true
      })
    }
    afterAbort?.()
  }

  return (
    <AddFolder
      visible={visible}
      isEncrypted={isEncrypted}
      extraColumns={extraColumns}
      onSubmit={onSubmit}
      onAbort={onAbort}
    />
  )
}

const AddFolderWithAfter = ({ refreshFolderContent, ...props }) => {
  const dispatch = useDispatch()
  const { addItems } = useNewItemHighlightContext()

  const handleAfterSubmit = () => {
    if (refreshFolderContent) {
      refreshFolderContent()
    }
    dispatch(hideNewFolderInput())
  }

  const handleAfterAbort = () => {
    dispatch(hideNewFolderInput())
  }

  return (
    <AddFolderWithState
      afterSubmit={handleAfterSubmit}
      afterAbort={handleAfterAbort}
      addItems={addItems}
      {...props}
    />
  )
}

export default AddFolderWithAfter
