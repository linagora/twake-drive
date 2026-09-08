import React, { useCallback, useMemo, useState } from 'react'

import { models } from 'cozy-client'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { FilePicker } from '@/components/FilePicker/FilePicker'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections
} from '@/components/FilePicker/constants'
import { FolderPickerHeader } from '@/components/FolderPicker/FolderPickerHeader'
import { ROOT_DIR_ID } from '@/constants/config'
import { getParentPath } from '@/lib/path'

const MOVE_TO_SECTIONS = [filePickerSections.DRIVE]
const MOVE_TO_DISPLAYED_TYPES = [filePickerItemTypes.FOLDER]

function isMoveDestination(item, entryIds) {
  const itemId = item?._id ?? item?.id
  return (
    Boolean(item) &&
    models.file.isDirectory(item) &&
    !item.driveId &&
    item.cozyMetadata?.createdByApp !== 'nextcloud' &&
    (!entryIds || !entryIds.has(itemId))
  )
}

const useStyles = makeStyles({
  paper: {
    height: '100%',
    '& .MuiDialogContent-root': {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      padding: '0'
    },
    '& .MuiDialogTitle-root': {
      padding: '0'
    },
    '& .dialogContentInner': {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      marginBottom: 0
    }
  }
})

function getInitialFolderId(currentFolder, entries) {
  const sourceFolderIds = new Set(
    entries
      .map(entry => entry.dir_id ?? getParentPath(entry.path))
      .filter(Boolean)
  )
  const isLocalFolder =
    currentFolder?._type === 'io.cozy.files' && !currentFolder.driveId

  if (!isLocalFolder || sourceFolderIds.size > 1) return ROOT_DIR_ID
  return currentFolder?._id ?? ROOT_DIR_ID
}

export function MoveTo({
  currentFolder,
  entries,
  onConfirm,
  onClose,
  isBusy = false
}) {
  const { t } = useI18n()
  const classes = useStyles()
  const initialFolderId = getInitialFolderId(currentFolder, entries)
  const entryIds = useMemo(
    () => new Set(entries.map(entry => entry._id ?? entry.id).filter(Boolean)),
    [entries]
  )
  const isItemVisible = useCallback(
    item => isMoveDestination(item, entryIds),
    [entryIds]
  )
  const initialLocation = {
    section: filePickerSections.DRIVE,
    folderId: initialFolderId,
    driveId: null
  }
  const [currentFolderState, setCurrentFolderState] = useState({
    folder: null,
    location: initialLocation,
    status: 'loading'
  })

  const destinationFolder = currentFolderState.folder
  const destinationError =
    currentFolderState.status === 'failed' ? 'DESTINATION_UNAVAILABLE' : null
  const isCurrentFolderInitial =
    currentFolderState.location.folderId === initialFolderId
  const canConfirm =
    !isCurrentFolderInitial &&
    currentFolderState.status === 'loaded' &&
    isMoveDestination(destinationFolder, entryIds)

  const handleConfirm = () => {
    if (canConfirm && destinationFolder) onConfirm(destinationFolder)
  }

  return (
    <FixedDialog
      open
      onClose={isBusy ? undefined : onClose}
      size="large"
      classes={{ paper: classes.paper }}
      title={<FolderPickerHeader entries={entries} />}
      content={
        <div
          className="u-pos-relative u-h-100 u-flex u-flex-column u-flex-grow-1"
          data-testid="move-to-browser"
        >
          <FilePicker
            mode={filePickerModes.CURRENT_FOLDER}
            initialLocation={initialLocation}
            availableSections={MOVE_TO_SECTIONS}
            displayedTypes={MOVE_TO_DISPLAYED_TYPES}
            selectableTypes={[]}
            isItemVisible={isItemVisible}
            error={destinationError}
            onCurrentFolderChange={setCurrentFolderState}
          />
        </div>
      }
      actions={
        <>
          <Buttons
            variant="secondary"
            label={t('Move.cancel')}
            onClick={onClose}
            disabled={isBusy}
          />
          <Buttons
            label={t('Move.action')}
            onClick={handleConfirm}
            disabled={!canConfirm || isBusy}
            busy={isBusy}
          />
        </>
      }
    />
  )
}
