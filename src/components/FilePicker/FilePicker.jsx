import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

function getSectionRoot(section, rootDirId = ROOT_DIR_ID) {
  if (section === filePickerSections.RECENTS) {
    return FILE_PICKER_RECENTS_ROOT_ID
  }
  return section === filePickerSections.SHARINGS
    ? FILE_PICKER_SHARINGS_ROOT_ID
    : rootDirId
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
  const lastReportedState = useRef(null)
  const query = useMemo(
    () => buildCurrentFolderQuery(location.folderId, location.driveId),
    [location.driveId, location.folderId]
  )
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
  const folder = useMemo(() => {
    if (status !== 'loaded' || !hasMatchingFolder) return null
    return location.driveId
      ? { ...queriedFolder, driveId: location.driveId }
      : queriedFolder
  }, [hasMatchingFolder, location.driveId, queriedFolder, status])

  useEffect(() => {
    if (!enabled) return

    const currentState = { folder, location, status }
    if (hasSameCurrentFolderState(lastReportedState.current, currentState)) {
      return
    }

    lastReportedState.current = currentState
    onCurrentFolderChange?.(currentState)
  }, [enabled, folder, location, onCurrentFolderChange, status])
}

const FilePickerController = ({
  mode,
  initialLocation,
  rootDirId,
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
  additionalItems
}) => {
  const { clearSelection } = useSelectionContext()
  const [sortOrder] = useFolderSort(ROOT_DIR_ID)
  // A root folder other than Drive's own confines the picker to that subtree:
  // Recents and Sharings would let the user out of it, so only Drive is
  // browsable, and browsing always starts at the root folder itself.
  const isDirScoped = rootDirId !== ROOT_DIR_ID
  const sections = isDirScoped ? [filePickerSections.DRIVE] : availableSections
  const initialSection = sections.includes(initialLocation.section)
    ? initialLocation.section
    : sections[0]
  const keepsInitialLocation =
    initialSection === initialLocation.section && !isDirScoped
  const [location, setLocation] = useState({
    section: initialSection,
    folderId: keepsInitialLocation
      ? initialLocation.folderId
      : getSectionRoot(initialSection, rootDirId),
    driveId: keepsInitialLocation ? initialLocation.driveId : null
  })
  const [isSectionChanging, setIsSectionChanging] = useState(false)

  const navigateTo = useCallback(
    folder => {
      if (isNavigationDisabled) return
      const folderId = folder.id ?? folder._id
      if (isDirScoped && folderId === FILE_PICKER_SHARINGS_ROOT_ID) return

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
    },
    [
      clearSelection,
      isDirScoped,
      isNavigationDisabled,
      location,
      onLocationChange
    ]
  )

  const handleSectionChange = section => {
    if (
      isNavigationDisabled ||
      !sections.includes(section) ||
      section === location.section
    ) {
      return
    }

    const nextLocation = {
      section,
      folderId: getSectionRoot(section, rootDirId),
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

  const handleSectionReady = useCallback(() => {
    setIsSectionChanging(false)
  }, [])

  const readyNotifiedRef = useRef(false)
  const handleReadyToUse = useCallback(() => {
    if (readyNotifiedRef.current) return
    readyNotifiedRef.current = true
    onReadyToUse?.()
  }, [onReadyToUse])

  return (
    <>
      {renderHeader?.({
        activeSection: location.section,
        availableSections: sections,
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
          rootDirId={rootDirId}
          displayedTypes={displayedTypes}
          selectableTypes={selectableTypes}
          multiple={multiple}
          error={error}
          onReadyToUse={handleReadyToUse}
          onFileDoubleClick={onFileDoubleClick}
          isItemIncluded={isItemIncluded}
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
  rootDirId: PropTypes.string,
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
  additionalItems: PropTypes.arrayOf(PropTypes.object)
}

export const FilePicker = ({ selectedItems, onSelectionChange, ...props }) => {
  const selection = useMemo(
    () => getSelectionMap(selectedItems),
    [selectedItems]
  )

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
  rootDirId: PropTypes.string,
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
  additionalItems: PropTypes.arrayOf(PropTypes.object)
}

FilePicker.defaultProps = {
  initialLocation: DEFAULT_LOCATION,
  rootDirId: ROOT_DIR_ID,
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
