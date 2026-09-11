import { FolderOutlined, Icon } from '@linagora/twake-icons'
import React, { useState } from 'react'
import { useDispatch } from 'react-redux'

import { models, useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { FilePicker } from '@/components/FilePicker/FilePicker'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections
} from '@/components/FilePicker/constants'
import { FolderPickerAddFolderItem } from '@/components/FolderPicker/FolderPickerAddFolderItem'
import { FolderPickerHeader } from '@/components/FolderPicker/FolderPickerHeader'
import { ROOT_DIR_ID } from '@/constants/config'
import { getParentPath, joinPath } from '@/lib/path'
import { createFolder } from '@/modules/navigation/duck'

const MOVE_TO_SECTIONS = [filePickerSections.DRIVE]
const MOVE_TO_DISPLAYED_TYPES = [filePickerItemTypes.FOLDER]

function getItemId(item) {
  return item?._id ?? item?.id ?? null
}

function isSameOrDescendantPath(candidatePath, ancestorPath) {
  if (typeof candidatePath !== 'string' || typeof ancestorPath !== 'string') {
    return false
  }
  return (
    candidatePath === ancestorPath ||
    (ancestorPath !== '/' &&
      candidatePath.startsWith(joinPath(ancestorPath, '')))
  )
}

function isDirectoryItem(item) {
  return Boolean(item) && models.file.isDirectory(item)
}

function isLocalItem(item) {
  return (
    Boolean(item) &&
    item._type !== 'io.cozy.remote.nextcloud.files' &&
    !item.driveId &&
    item.cozyMetadata?.createdByApp !== 'nextcloud'
  )
}

function isLocalMoveDestination(item) {
  return isDirectoryItem(item) && isLocalItem(item)
}

function isDescendantOfEntry(item, entry) {
  const itemId = getItemId(item)
  const entryId = getItemId(entry)
  if (itemId && entryId && itemId === entryId) return true
  if (!isLocalItem(item) || !isLocalItem(entry)) return false

  if (item.dir_id && entryId && item.dir_id === entryId) return true

  if (item.path && entry.path) {
    return isSameOrDescendantPath(item.path, entry.path)
  }

  return false
}

export function getMoveDestinationDisabledReason(
  item,
  entries,
  hasWriteAccess,
  allLoaded = true
) {
  if (!isLocalMoveDestination(item)) return null

  const directoryEntries = entries.filter(isDirectoryItem)
  const sourceEntry = directoryEntries.find(entry =>
    isDescendantOfEntry(item, entry)
  )
  if (sourceEntry) {
    return getItemId(item) === getItemId(sourceEntry)
      ? 'Move.destinationSource'
      : 'Move.destinationDescendant'
  }

  if (allLoaded !== true) return 'Move.permissionsLoading'

  if (typeof hasWriteAccess === 'function') {
    const itemId = getItemId(item)
    if (itemId && !hasWriteAccess(itemId, item.driveId)) {
      return 'Move.destinationReadOnly'
    }
  }

  return null
}

function isMoveDestination(item, entries, hasWriteAccess, allLoaded = true) {
  return (
    isLocalMoveDestination(item) &&
    !getMoveDestinationDisabledReason(item, entries, hasWriteAccess, allLoaded)
  )
}

function getEntryParentId(entry) {
  return (
    entry.dir_id ??
    (typeof entry.path === 'string' ? getParentPath(entry.path) : null)
  )
}

function isEntryInFolder(entry, folder) {
  const folderId = getItemId(folder)
  if (entry.dir_id && folderId && entry.dir_id === folderId) return true
  if (!isLocalItem(entry) || !isLocalItem(folder)) return false
  return Boolean(
    entry.path && folder?.path && getParentPath(entry.path) === folder.path
  )
}

function areAllEntriesInFolder(entries, folder) {
  return (
    entries.length > 0 && entries.every(entry => isEntryInFolder(entry, folder))
  )
}

function hasUnknownEntryLocation(entries) {
  return entries.some(entry => !entry.dir_id && !entry.path)
}

function getInitialFolderId(currentFolder, entries) {
  const sourceFolderIds = new Set(entries.map(getEntryParentId).filter(Boolean))
  const isLocalFolder =
    currentFolder?._type === 'io.cozy.files' && !currentFolder.driveId

  if (!isLocalFolder || sourceFolderIds.size > 1) return ROOT_DIR_ID
  return currentFolder?._id ?? ROOT_DIR_ID
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

export function MoveTo({
  currentFolder,
  entries,
  onConfirm,
  onClose,
  isBusy = false
}) {
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const client = useClient()
  const dispatch = useDispatch()
  const classes = useStyles()
  const { allLoaded, hasWriteAccess } = useSharingContext()
  const initialFolderId = getInitialFolderId(currentFolder, entries)
  const initialLocation = {
    section: filePickerSections.DRIVE,
    folderId: initialFolderId,
    driveId: null
  }
  const [isFolderCreationDisplayed, setFolderCreationDisplayed] =
    useState(false)
  const [isCreatingFolder, setCreatingFolder] = useState(false)
  const [createdItems, setCreatedItems] = useState([])
  const [currentFolderState, setCurrentFolderState] = useState({
    folder: null,
    location: initialLocation,
    status: 'loading'
  })
  const isBrowserBusy = isBusy || isCreatingFolder
  const isItemVisible = isLocalMoveDestination
  const getItemDisabledReason = item =>
    isBrowserBusy
      ? 'Move.folderCreationInProgress'
      : getMoveDestinationDisabledReason(
          item,
          entries,
          hasWriteAccess,
          allLoaded
        )
  const isItemDisabled = item => Boolean(getItemDisabledReason(item))
  const destinationFolder = currentFolderState.folder
  const destinationError =
    currentFolderState.status === 'failed' ? 'DESTINATION_UNAVAILABLE' : null
  const isDestinationWritable = Boolean(
    destinationFolder &&
    (!hasWriteAccess ||
      hasWriteAccess(getItemId(destinationFolder), destinationFolder.driveId))
  )
  const canConfirm =
    currentFolderState.status === 'loaded' &&
    allLoaded === true &&
    isMoveDestination(destinationFolder, entries, hasWriteAccess, allLoaded) &&
    !(
      currentFolderState.location.folderId === initialFolderId &&
      (areAllEntriesInFolder(entries, destinationFolder) ||
        hasUnknownEntryLocation(entries))
    )
  const canCreateFolder = Boolean(
    allLoaded &&
    currentFolderState.status === 'loaded' &&
    destinationFolder &&
    isLocalMoveDestination(destinationFolder) &&
    isDestinationWritable
  )

  const handleConfirm = () => {
    if (canConfirm && destinationFolder && !isBrowserBusy) {
      onConfirm(destinationFolder)
    }
  }

  const handleCreate = () => {
    if (!isBrowserBusy && canCreateFolder) setFolderCreationDisplayed(true)
  }

  const handleItemsAdded = items => {
    setCreatedItems(previousItems => [...previousItems, ...items])
  }

  const handleFolderCreation = async name => {
    setCreatingFolder(true)
    try {
      await dispatch(
        createFolder(
          client,
          name,
          currentFolderState.location.folderId,
          { showAlert, t },
          currentFolderState.location.driveId,
          handleItemsAdded
        )
      )
      setFolderCreationDisplayed(false)
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleAbortCreation = () => {
    if (!isCreatingFolder) setFolderCreationDisplayed(false)
  }

  return (
    <FixedDialog
      open
      onClose={isBrowserBusy ? undefined : onClose}
      size="large"
      classes={{ paper: classes.paper }}
      title={<FolderPickerHeader entries={entries} />}
      content={
        <div
          className="u-pos-relative u-h-100 u-flex u-flex-column u-flex-grow-1"
          data-testid="move-to-browser"
        >
          <span className="u-visuallyhidden" role="status" aria-live="polite">
            {isCreatingFolder ? t('Move.folderCreationInProgress') : null}
          </span>
          <FilePicker
            mode={filePickerModes.CURRENT_FOLDER}
            initialLocation={initialLocation}
            availableSections={MOVE_TO_SECTIONS}
            displayedTypes={MOVE_TO_DISPLAYED_TYPES}
            selectableTypes={[]}
            isItemVisible={isItemVisible}
            isItemDisabled={isItemDisabled}
            getItemDisabledReason={getItemDisabledReason}
            isNavigationDisabled={isBrowserBusy}
            filterReceivedShares={false}
            additionalItems={createdItems}
            beforeItems={
              isFolderCreationDisplayed && canCreateFolder ? (
                <FolderPickerAddFolderItem
                  currentFolderId={currentFolderState.location.folderId}
                  driveId={currentFolderState.location.driveId}
                  visible
                  afterAbort={handleAbortCreation}
                  onSubmit={handleFolderCreation}
                  inputAriaLabel={t('Move.folderName')}
                  errorMessage={t('Move.folderCreationError')}
                  disableGutters
                />
              ) : null
            }
            error={destinationError}
            onCurrentFolderChange={setCurrentFolderState}
          />
        </div>
      }
      actions={
        <>
          {canCreateFolder && (
            <Buttons
              className="u-mr-auto"
              disabled={isBrowserBusy || isFolderCreationDisplayed}
              label={t('Move.addFolder')}
              onClick={handleCreate}
              startIcon={<Icon icon={FolderOutlined} />}
              variant="ghost"
            />
          )}
          <Buttons
            variant="secondary"
            label={t('Move.cancel')}
            onClick={onClose}
            disabled={isBrowserBusy}
          />
          <Buttons
            label={t('Move.action')}
            onClick={handleConfirm}
            disabled={!canConfirm || isBrowserBusy}
            busy={isBusy}
          />
        </>
      }
    />
  )
}
