import React, { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'

import { fetchPolicies, useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useI18n } from 'twake-i18n'

import {
  getInitialFolderId,
  getItemId,
  getMoveDestinationDisabledReason,
  isDestinationAllowed,
  isDirectoryItem,
  isMoveBrowserItem,
  isMoveDestinationFolder
} from '../helpers'

import { FilePicker } from '@/components/FilePicker/FilePicker'
import { FilePickerHeaderTabs } from '@/components/FilePicker/FilePickerHeaderTabs'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections
} from '@/components/FilePicker/constants'
import { buildCurrentFolderQuery } from '@/components/FilePicker/queries'
import { FolderPickerAddFolderItem } from '@/components/FolderPicker/FolderPickerAddFolderItem'
import { MoveDestinationActions } from '@/modules/move/components/MoveDestinationActions'
import { createFolder } from '@/modules/navigation/duck'

const MOVE_TO_SECTIONS = [filePickerSections.DRIVE, filePickerSections.SHARINGS]
const MOVE_TO_DISPLAYED_TYPES = [
  filePickerItemTypes.FOLDER,
  filePickerItemTypes.FILE
]

function useMoveDestinationReadiness({
  onReadyToUse,
  isContentReady,
  folderStatus,
  allLoaded
}) {
  // Folder resolution and listing readiness complete independently.
  const readyNotifiedRef = useRef(false)
  useEffect(() => {
    if (!onReadyToUse) return
    if (readyNotifiedRef.current) return
    if (!isContentReady) return
    if (folderStatus === 'loading') return
    if (allLoaded !== true) return
    readyNotifiedRef.current = true
    onReadyToUse()
  }, [isContentReady, folderStatus, allLoaded, onReadyToUse])
}

function canCreateDestinationFolder({
  folder,
  status,
  allLoaded,
  isDestinationWritable
}) {
  if (!allLoaded) return false
  if (status !== 'loaded') return false
  if (!folder) return false
  if (!isMoveDestinationFolder(folder)) return false
  return isDestinationWritable
}

function getMoveBrowserState({
  isBusy,
  isCreatingFolder,
  isValidatingDestination,
  allLoaded,
  isDestinationLocked
}) {
  const isBrowserBusy =
    isBusy || isCreatingFolder || isValidatingDestination || allLoaded !== true
  const isNavigationLocked = isBrowserBusy || isDestinationLocked
  return { isBrowserBusy, isNavigationLocked }
}

function getDestinationState({
  currentFolderState,
  confirmationError,
  resultError,
  entries,
  hasWriteAccess,
  allLoaded,
  initialFolderId
}) {
  const destinationFolder = currentFolderState.folder
  const destinationError =
    confirmationError ||
    resultError ||
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
  const canCreateFolder = canCreateDestinationFolder({
    folder: destinationFolder,
    status: currentFolderState.status,
    allLoaded,
    isDestinationWritable
  })

  return { destinationFolder, destinationError, canConfirm, canCreateFolder }
}

async function fetchCurrentDestination(client, location) {
  const query = buildCurrentFolderQuery(location.folderId, location.driveId)
  const result = await client.query(query.definition(), {
    ...query.options,
    as: `move-confirm-${location.folderId}`,
    fetchPolicy: fetchPolicies.olderThan(0)
  })
  if (!result?.data) return null
  return {
    ...result.data,
    ...(location.driveId ? { driveId: location.driveId } : {})
  }
}

export function useMoveDestinationPicker({
  currentFolder,
  entries,
  onConfirm,
  onClose,
  isBusy = false,
  isDestinationLocked = false,
  initialLocation: configuredInitialLocation = null,
  availableSections = MOVE_TO_SECTIONS,
  restrictedRoot = null,
  canNavigateTo = null,
  onReadyToUse,
  resultError = null,
  onRetryResult = null
}) {
  const { t } = useI18n()
  const client = useClient()
  const dispatch = useDispatch()
  const { allLoaded, hasWriteAccess } = useSharingContext()
  const [initialLocation] = useState(
    () =>
      configuredInitialLocation || {
        section: filePickerSections.DRIVE,
        folderId: getInitialFolderId(currentFolder, entries),
        driveId: null
      }
  )
  const initialFolderId = initialLocation.folderId
  const [isContentReady, setContentReady] = useState(false)
  const [isFolderCreationDisplayed, setFolderCreationDisplayed] =
    useState(false)
  const [isCreatingFolder, setCreatingFolder] = useState(false)
  const [isValidatingDestination, setValidatingDestination] = useState(false)
  const validatingDestinationRef = useRef(false)
  const [confirmationError, setConfirmationError] = useState(null)
  const [createdItems, setCreatedItems] = useState([])
  const [currentFolderState, setCurrentFolderState] = useState({
    folder: null,
    location: initialLocation,
    status: 'loading'
  })
  useMoveDestinationReadiness({
    onReadyToUse,
    isContentReady,
    folderStatus: currentFolderState.status,
    allLoaded
  })

  const handleContentReady = () => setContentReady(true)
  const { isBrowserBusy, isNavigationLocked } = getMoveBrowserState({
    isBusy,
    isCreatingFolder,
    isValidatingDestination,
    allLoaded,
    isDestinationLocked
  })
  const isItemIncluded = isMoveBrowserItem
  const isItemDisabled = item => !isDirectoryItem(item)
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
  const { destinationFolder, destinationError, canConfirm, canCreateFolder } =
    getDestinationState({
      currentFolderState,
      confirmationError,
      resultError,
      entries,
      hasWriteAccess,
      allLoaded,
      initialFolderId
    })

  const fetchValidatedDestination = async folder => {
    if (getItemId(folder) !== currentFolderState.location.folderId)
      throw new Error('Destination changed')
    const freshDestination = await fetchCurrentDestination(
      client,
      currentFolderState.location
    )
    const isFreshDestinationValid =
      getItemId(freshDestination) === currentFolderState.location.folderId &&
      isDestinationAllowed(
        freshDestination,
        entries,
        hasWriteAccess,
        allLoaded,
        initialFolderId
      ) &&
      (!canNavigateTo || (await canNavigateTo(freshDestination)))

    if (!isFreshDestinationValid) throw new Error('Destination unavailable')
    return freshDestination
  }

  const handleConfirm = async () => {
    if (
      !onConfirm ||
      !canConfirm ||
      !destinationFolder ||
      isBrowserBusy ||
      validatingDestinationRef.current
    )
      return
    validatingDestinationRef.current = true
    setValidatingDestination(true)
    setConfirmationError(null)
    try {
      const freshDestination =
        await fetchValidatedDestination(destinationFolder)
      onConfirm(freshDestination)
    } catch {
      setConfirmationError('DESTINATION_UNAVAILABLE')
    } finally {
      validatingDestinationRef.current = false
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

  return {
    isBrowserBusy,
    fetchValidatedDestination,
    content: (
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
          availableSections={availableSections}
          restrictedRoot={restrictedRoot}
          canNavigateTo={canNavigateTo}
          onReadyToUse={onReadyToUse ? handleContentReady : undefined}
          renderHeader={headerProps => (
            <header className="u-pl-1">
              <FilePickerHeaderTabs {...headerProps} />
            </header>
          )}
          displayedTypes={MOVE_TO_DISPLAYED_TYPES}
          selectableTypes={[]}
          isItemIncluded={isItemIncluded}
          isItemDisabled={isItemDisabled}
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
    ),
    actions: (
      <MoveDestinationActions
        canCreateFolder={canCreateFolder}
        isNavigationLocked={isNavigationLocked}
        isFolderCreationDisplayed={isFolderCreationDisplayed}
        onCreate={handleCreate}
        onClose={onClose}
        isBrowserBusy={isBrowserBusy}
        onRetryResult={onRetryResult}
        onConfirm={handleConfirm}
        hasConfirmHandler={Boolean(onConfirm)}
        canConfirm={canConfirm}
        isBusy={isBusy}
        isValidatingDestination={isValidatingDestination}
      />
    )
  }
}
