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
  isItemVisible
}) => {
  const { clearSelection } = useSelectionContext()
  const initialSection = availableSections.includes(initialLocation.section)
    ? initialLocation.section
    : availableSections[0]
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

  const navigateTo = useCallback(
    folder => {
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
    },
    [clearSelection, location, onLocationChange]
  )

  const handleSectionChange = section => {
    if (!availableSections.includes(section) || section === location.section) {
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

  const handleSectionReady = useCallback(() => {
    setIsSectionChanging(false)
  }, [])

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
          navigateTo={navigateTo}
          section={location.section}
          folderId={location.folderId}
          driveId={location.driveId}
          displayedTypes={displayedTypes}
          selectableTypes={selectableTypes}
          multiple={multiple}
          error={error}
          onReadyToUse={onReadyToUse}
          onFileDoubleClick={onFileDoubleClick}
          isItemVisible={isItemVisible}
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
  isItemVisible: PropTypes.func
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
  isItemVisible: PropTypes.func
}

FilePicker.defaultProps = {
  initialLocation: DEFAULT_LOCATION,
  availableSections: Object.values(filePickerSections),
  displayedTypes: Object.values(filePickerItemTypes),
  selectableTypes: Object.values(filePickerItemTypes),
  multiple: false,
  error: null,
  isItemVisible: () => true
}
