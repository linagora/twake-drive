import { FolderOutlined, Icon } from '@linagora/twake-icons'
import React, { useState } from 'react'
import { useDispatch } from 'react-redux'

import { fetchPolicies, useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import {
  getInitialFolderId,
  getItemId,
  getMoveDestinationDisabledReason,
  isDestinationAllowed,
  isMoveDestinationFolder
} from './helpers'

import { FilePicker } from '@/components/FilePicker/FilePicker'
import { FilePickerHeaderTabs } from '@/components/FilePicker/FilePickerHeaderTabs'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections
} from '@/components/FilePicker/constants'
import { buildCurrentFolderQuery } from '@/components/FilePicker/queries'
import { FolderPickerAddFolderItem } from '@/components/FolderPicker/FolderPickerAddFolderItem'
import { FolderPickerHeader } from '@/components/FolderPicker/FolderPickerHeader'
import { createFolder } from '@/modules/navigation/duck'

const MOVE_TO_SECTIONS = [filePickerSections.DRIVE, filePickerSections.SHARINGS]
const MOVE_TO_DISPLAYED_TYPES = [filePickerItemTypes.FOLDER]

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
  isBusy = false,
  isDestinationLocked = false
}) {
  const { t } = useI18n()
  const client = useClient()
  const dispatch = useDispatch()
  const classes = useStyles()
  const { allLoaded, hasWriteAccess } = useSharingContext()
  const [initialFolderId] = useState(() =>
    getInitialFolderId(currentFolder, entries)
  )
  const initialLocation = {
    section: filePickerSections.DRIVE,
    folderId: initialFolderId,
    driveId: null
  }
  const [isFolderCreationDisplayed, setFolderCreationDisplayed] =
    useState(false)
  const [isCreatingFolder, setCreatingFolder] = useState(false)
  const [isValidatingDestination, setValidatingDestination] = useState(false)
  const [confirmationError, setConfirmationError] = useState(null)
  const [createdItems, setCreatedItems] = useState([])
  const [currentFolderState, setCurrentFolderState] = useState({
    folder: null,
    location: initialLocation,
    status: 'loading'
  })
  const isBrowserBusy =
    isBusy || isCreatingFolder || isValidatingDestination || allLoaded !== true
  const isNavigationLocked = isBrowserBusy || isDestinationLocked
  const isItemIncluded = isMoveDestinationFolder
  const getItemDisabledReason = item => {
    if (isBusy || isValidatingDestination) return 'Move.moveInProgress'
    if (isCreatingFolder) return 'Move.folderCreationInProgress'
    if (isDestinationLocked) return 'Move.destinationLocked'
    return getMoveDestinationDisabledReason(
      item,
      entries,
      hasWriteAccess,
      allLoaded
    )
  }
  const destinationFolder = currentFolderState.folder
  const destinationError =
    confirmationError ||
    (currentFolderState.status === 'failed' ? 'DESTINATION_UNAVAILABLE' : null)
  const isDestinationWritable = Boolean(
    destinationFolder &&
    (!hasWriteAccess ||
      hasWriteAccess(getItemId(destinationFolder), destinationFolder.driveId))
  )
  const canConfirm =
    currentFolderState.status === 'loaded' &&
    allLoaded === true &&
    Boolean(destinationFolder) &&
    isDestinationAllowed(
      destinationFolder,
      entries,
      hasWriteAccess,
      allLoaded,
      initialFolderId
    )
  const canCreateFolder = Boolean(
    allLoaded &&
    currentFolderState.status === 'loaded' &&
    destinationFolder &&
    isMoveDestinationFolder(destinationFolder) &&
    isDestinationWritable
  )

  const handleConfirm = async () => {
    if (!canConfirm || !destinationFolder || isBrowserBusy) return

    setValidatingDestination(true)
    setConfirmationError(null)
    try {
      const query = buildCurrentFolderQuery(
        currentFolderState.location.folderId,
        currentFolderState.location.driveId
      )
      const result = await client.query(query.definition(), {
        ...query.options,
        as: `move-confirm-${currentFolderState.location.folderId}`,
        fetchPolicy: fetchPolicies.olderThan(0)
      })
      const freshDestination = result?.data
        ? {
            ...result.data,
            ...(currentFolderState.location.driveId
              ? { driveId: currentFolderState.location.driveId }
              : {})
          }
        : null
      const isFreshDestinationValid =
        getItemId(freshDestination) === currentFolderState.location.folderId &&
        isDestinationAllowed(
          freshDestination,
          entries,
          hasWriteAccess,
          allLoaded,
          initialFolderId
        )

      if (!isFreshDestinationValid) {
        setConfirmationError('DESTINATION_UNAVAILABLE')
        return
      }
      onConfirm(freshDestination)
    } catch {
      setConfirmationError('DESTINATION_UNAVAILABLE')
    } finally {
      setValidatingDestination(false)
    }
  }

  const handleCurrentFolderChange = state => {
    setConfirmationError(null)
    setCurrentFolderState(state)
  }

  const handleCreate = () => {
    if (!isNavigationLocked && canCreateFolder) {
      setFolderCreationDisplayed(true)
    }
  }

  const handleItemsAdded = items => {
    const driveId = currentFolderState.location.driveId
    const itemsWithDriveId = driveId
      ? items.map(item => ({ ...item, driveId }))
      : items
    setCreatedItems(previousItems => [...previousItems, ...itemsWithDriveId])
  }

  const handleFolderCreation = async name => {
    setCreatingFolder(true)
    try {
      await dispatch(
        createFolder(
          client,
          name,
          currentFolderState.location.folderId,
          { t },
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
            renderHeader={headerProps => (
              <FilePickerHeaderTabs {...headerProps} />
            )}
            displayedTypes={MOVE_TO_DISPLAYED_TYPES}
            selectableTypes={[]}
            isItemIncluded={isItemIncluded}
            getItemDisabledReason={getItemDisabledReason}
            isNavigationDisabled={isNavigationLocked}
            additionalItems={createdItems}
            beforeItems={
              isFolderCreationDisplayed &&
              canCreateFolder &&
              !isDestinationLocked ? (
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
            onCurrentFolderChange={handleCurrentFolderChange}
          />
        </div>
      }
      actions={
        <>
          {canCreateFolder && (
            <Buttons
              className="u-mr-auto"
              disabled={isNavigationLocked || isFolderCreationDisplayed}
              label={t('Move.addFolder')}
              onClick={handleCreate}
              startIcon={<Icon icon={FolderOutlined} size={16} />}
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
            busy={isBusy || isValidatingDestination}
          />
        </>
      }
    />
  )
}
