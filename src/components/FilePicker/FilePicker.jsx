import PropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'

import { isQueryLoading, useQuery } from 'cozy-client'
import Box from 'cozy-ui/transpiled/react/Box'

import { FilePickerBody } from './FilePickerBody'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections,
  FILE_PICKER_RECENTS_ROOT_ID,
  FILE_PICKER_SHARINGS_ROOT_ID
} from './constants'
import { buildCurrentFolderQuery } from './queries'

import { ROOT_DIR_ID } from '@/constants/config'
import { useFolderSort } from '@/hooks'
import {
  SelectionProvider,
  useSelectionContext
} from '@/modules/selection/SelectionProvider'

const DEFAULT_LOCATION = {
  section: filePickerSections.DRIVE,
  folderId: ROOT_DIR_ID,
  driveId: null
}

function getSectionRoot(section) {
  if (section === filePickerSections.RECENTS) {
    return FILE_PICKER_RECENTS_ROOT_ID
  }
  return section === filePickerSections.SHARINGS
    ? FILE_PICKER_SHARINGS_ROOT_ID
    : ROOT_DIR_ID
}

function getSelectionMap(selectedItems) {
  return selectedItems?.reduce((itemsById, item) => {
    itemsById[item._id] = item
    return itemsById
  }, {})
}

function hasSameCurrentFolderState(previousState, nextState) {
  if (!previousState) return false

  return (
    previousState.status === nextState.status &&
    previousState.location.section === nextState.location.section &&
    previousState.location.folderId === nextState.location.folderId &&
    previousState.location.driveId === nextState.location.driveId &&
    (previousState.folder?._id ?? previousState.folder?.id) ===
      (nextState.folder?._id ?? nextState.folder?.id) &&
    previousState.folder?._rev === nextState.folder?._rev &&
    previousState.folder?.name === nextState.folder?.name &&
    previousState.folder?.path === nextState.folder?.path &&
    previousState.folder?.driveId === nextState.folder?.driveId
  )
}

function useCurrentFolderResolver({
  enabled,
  location,
  onCurrentFolderChange
}) {
  const isVirtual = [
    FILE_PICKER_RECENTS_ROOT_ID,
    FILE_PICKER_SHARINGS_ROOT_ID
  ].includes(location.folderId)
  // Parent folder updates can rerender the picker; do not report them again.
  const lastReportedState = useRef(null)
  const query = buildCurrentFolderQuery(location.folderId, location.driveId)
  const result = useQuery(query.definition, {
    ...query.options,
    enabled: enabled && !isVirtual
  })
  const queriedFolder = enabled && !isVirtual ? (result.data ?? null) : null
  const queriedFolderId = queriedFolder?._id ?? queriedFolder?.id
  const hasMatchingFolder = queriedFolderId === location.folderId
  const hasStaleFolder = queriedFolder !== null && !hasMatchingFolder
  const status =
    !enabled || isVirtual
      ? 'loaded'
      : hasStaleFolder || isQueryLoading(result)
        ? 'loading'
        : result.fetchStatus === 'failed'
          ? 'failed'
          : 'loaded'
  // Report resolved folders after commit, never while rendering a parent update.
  useEffect(() => {
    if (!enabled) return

    const folder =
      status !== 'loaded' || !hasMatchingFolder
        ? null
        : location.driveId
          ? { ...queriedFolder, driveId: location.driveId }
          : queriedFolder
    const currentState = { folder, location, status }
    if (hasSameCurrentFolderState(lastReportedState.current, currentState)) {
      return
    }

    lastReportedState.current = currentState
    onCurrentFolderChange?.(currentState)
  }, [
    enabled,
    hasMatchingFolder,
    location,
    onCurrentFolderChange,
    queriedFolder,
    status
  ])
}

const FilePickerController = ({
  mode,
  initialLocation,
  availableSections,
  displayedTypes,
  selectableTypes,
  multiple,
  onLocationChange,
  onCurrentFolderChange,
  onFileDoubleClick,
  onReadyToUse,
  error,
  renderHeader,
  isItemIncluded,
  isItemDisabled,
  getItemDisabledReason,
  isNavigationDisabled,
  beforeItems,
  filterReceivedShares,
  additionalItems,
  restrictedRoot,
  canNavigateTo
}) => {
  const { clearSelection } = useSelectionContext()
  const [sortOrder] = useFolderSort(ROOT_DIR_ID)
  const initialSection = availableSections.includes(initialLocation.section)
    ? initialLocation.section
    : availableSections[0]
  // Keep the folder and pending section transition until the new content settles.
  const [location, setLocation] = useState({
    section: initialSection,
    folderId:
      initialSection === initialLocation.section
        ? initialLocation.folderId
        : getSectionRoot(initialSection),
    driveId:
      initialSection === initialLocation.section
        ? initialLocation.driveId
        : null
  })
  const [isSectionChanging, setIsSectionChanging] = useState(false)
  // A slower ancestry check must not override a more recent navigation request.
  const navigationRequestRef = useRef(0)

  const navigateTo = async folder => {
    if (isNavigationDisabled) return
    const request = ++navigationRequestRef.current
    if (restrictedRoot && !canNavigateTo) return
    if (canNavigateTo && !(await canNavigateTo(folder))) return
    if (request !== navigationRequestRef.current) return
    const folderId = folder.id ?? folder._id
    const nextLocation =
      folderId === FILE_PICKER_SHARINGS_ROOT_ID
        ? {
            section: filePickerSections.SHARINGS,
            folderId: FILE_PICKER_SHARINGS_ROOT_ID,
            driveId: null
          }
        : {
            ...location,
            folderId,
            driveId:
              folder.driveId ??
              (folderId === ROOT_DIR_ID ? null : location.driveId)
          }

    setLocation(nextLocation)
    onLocationChange?.(nextLocation)
    clearSelection()
  }

  const handleSectionChange = section => {
    if (
      isNavigationDisabled ||
      restrictedRoot ||
      !availableSections.includes(section) ||
      section === location.section
    ) {
      return
    }

    const nextLocation = {
      section,
      folderId: getSectionRoot(section),
      driveId: null
    }
    setIsSectionChanging(true)
    setLocation(nextLocation)
    onLocationChange?.(nextLocation)
    clearSelection()
  }

  useCurrentFolderResolver({
    enabled: mode === filePickerModes.CURRENT_FOLDER,
    location,
    onCurrentFolderChange
  })

  const handleSectionReady = () => {
    setIsSectionChanging(false)
  }

  // Section bodies remount; readiness belongs to the whole picker lifetime.
  const readyNotifiedRef = useRef(false)
  const handleReadyToUse = () => {
    if (readyNotifiedRef.current) return
    readyNotifiedRef.current = true
    onReadyToUse?.()
  }

  return (
    <>
      {renderHeader?.({
        activeSection: location.section,
        availableSections,
        onSectionChange: handleSectionChange
      })}
      <Box
        flex={1}
        minHeight={0}
        className="u-pos-relative"
        data-testid="file-picker-body-wrapper"
      >
        <FilePickerBody
          key={location.section}
          mode={mode}
          isSectionChanging={isSectionChanging}
          onSectionReady={handleSectionReady}
          sortOrder={sortOrder}
          navigateTo={navigateTo}
          section={location.section}
          folderId={location.folderId}
          driveId={location.driveId}
          displayedTypes={displayedTypes}
          selectableTypes={selectableTypes}
          multiple={multiple}
          error={error}
          onReadyToUse={handleReadyToUse}
          onFileDoubleClick={onFileDoubleClick}
          restrictedRoot={restrictedRoot}
          isItemIncluded={item =>
            isItemIncluded(item) &&
            (!restrictedRoot ||
              (!item.driveId && item.dir_id === location.folderId))
          }
          isItemDisabled={isItemDisabled}
          getItemDisabledReason={getItemDisabledReason}
          beforeItems={beforeItems}
          isNavigationDisabled={isNavigationDisabled}
          filterReceivedShares={filterReceivedShares}
          additionalItems={additionalItems}
        />
      </Box>
    </>
  )
}

FilePickerController.propTypes = {
  mode: PropTypes.oneOf(Object.values(filePickerModes)).isRequired,
  initialLocation: PropTypes.shape({
    section: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
    folderId: PropTypes.string.isRequired,
    driveId: PropTypes.string
  }).isRequired,
  availableSections: PropTypes.arrayOf(
    PropTypes.oneOf(Object.values(filePickerSections))
  ).isRequired,
  displayedTypes: PropTypes.arrayOf(
    PropTypes.oneOf(Object.values(filePickerItemTypes))
  ).isRequired,
  selectableTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  onLocationChange: PropTypes.func,
  onCurrentFolderChange: PropTypes.func,
  onFileDoubleClick: PropTypes.func,
  onReadyToUse: PropTypes.func,
  error: PropTypes.string,
  renderHeader: PropTypes.func,
  isItemIncluded: PropTypes.func,
  isItemDisabled: PropTypes.func,
  getItemDisabledReason: PropTypes.func,
  isNavigationDisabled: PropTypes.bool,
  beforeItems: PropTypes.node,
  filterReceivedShares: PropTypes.bool,
  additionalItems: PropTypes.arrayOf(PropTypes.object),
  restrictedRoot: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string
  }),
  canNavigateTo: PropTypes.func
}

export const FilePicker = ({ selectedItems, onSelectionChange, ...props }) => {
  const selection = getSelectionMap(selectedItems)

  return (
    <SelectionProvider
      clearOnLocationChange={false}
      selection={selection}
      onSelectionChange={onSelectionChange}
    >
      <FilePickerController {...props} />
    </SelectionProvider>
  )
}

FilePicker.propTypes = {
  mode: PropTypes.oneOf(Object.values(filePickerModes)).isRequired,
  initialLocation: PropTypes.shape({
    section: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
    folderId: PropTypes.string.isRequired,
    driveId: PropTypes.string
  }),
  availableSections: PropTypes.arrayOf(
    PropTypes.oneOf(Object.values(filePickerSections))
  ),
  displayedTypes: PropTypes.arrayOf(
    PropTypes.oneOf(Object.values(filePickerItemTypes))
  ),
  selectableTypes: PropTypes.arrayOf(PropTypes.string),
  multiple: PropTypes.bool,
  selectedItems: PropTypes.arrayOf(PropTypes.object),
  onSelectionChange: PropTypes.func,
  onLocationChange: PropTypes.func,
  onCurrentFolderChange: PropTypes.func,
  onFileDoubleClick: PropTypes.func,
  onReadyToUse: PropTypes.func,
  error: PropTypes.string,
  renderHeader: PropTypes.func,
  isItemIncluded: PropTypes.func,
  isItemDisabled: PropTypes.func,
  getItemDisabledReason: PropTypes.func,
  isNavigationDisabled: PropTypes.bool,
  beforeItems: PropTypes.node,
  filterReceivedShares: PropTypes.bool,
  additionalItems: PropTypes.arrayOf(PropTypes.object),
  restrictedRoot: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string
  }),
  canNavigateTo: PropTypes.func
}

FilePicker.defaultProps = {
  initialLocation: DEFAULT_LOCATION,
  availableSections: Object.values(filePickerSections),
  displayedTypes: Object.values(filePickerItemTypes),
  selectableTypes: Object.values(filePickerItemTypes),
  multiple: false,
  error: null,
  isItemIncluded: () => true,
  isItemDisabled: () => false,
  getItemDisabledReason: () => null,
  isNavigationDisabled: false,
  beforeItems: null,
  filterReceivedShares: true,
  additionalItems: []
}
