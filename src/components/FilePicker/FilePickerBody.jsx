import PropTypes from 'prop-types'
import React, { useCallback, useMemo, useRef, useState } from 'react'

import { models } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { FilePickerSharingsContent } from './FilePickerSharingsContent'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections,
  FILE_PICKER_RECENTS_ROOT_ID,
  FILE_PICKER_SHARINGS_ROOT_ID
} from './constants'
import { isItemTypeDisplayed, isValidFile } from './helpers'
import { buildDisplayedContentFolderQuery } from './queries'
import { useFilePickerAdapter } from './useFilePickerAdapter'

import { EmptyMessage as PickerViewEmptyMessage } from '@/components/PickerView/EmptyMessage'
import { PickerView } from '@/components/PickerView/PickerView'
import { useLocalFolderBrowser } from '@/components/PickerView/useLocalFolderBrowser'
import { DEFAULT_SORT } from '@/config/sort'
import { ROOT_DIR_ID } from '@/constants/config'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { FilePickerRecentsContent } from '@/modules/services/components/FilePicker/FilePickerRecentsContent'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { sortFiles } from '@/modules/views/Folder/sortFiles'

const {
  file: { isDirectory }
} = models

const filePickerContentPropTypes = {
  source: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    fetchStatus: PropTypes.string.isRequired,
    hasMore: PropTypes.bool,
    fetchMore: PropTypes.func,
    breadcrumbPath: PropTypes.array,
    isItemDisabled: PropTypes.func.isRequired,
    getItemDisabledReason: PropTypes.func,
    withFilePath: PropTypes.bool,
    isFetchingMore: PropTypes.bool,
    keepItemsOnError: PropTypes.bool,
    emptyMessageKey: PropTypes.string,
    errorMessageKey: PropTypes.string
  }).isRequired,
  mode: PropTypes.oneOf(Object.values(filePickerModes)).isRequired,
  navigateTo: PropTypes.func.isRequired,
  selectableTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  error: PropTypes.string,
  onFileDoubleClick: PropTypes.func,
  isSectionChanging: PropTypes.bool,
  onSectionReady: PropTypes.func,
  emptyMessage: PropTypes.node,
  beforeItems: PropTypes.node,
  isNavigationDisabled: PropTypes.bool
}

const CurrentFolderContent = ({
  source,
  navigateTo,
  error,
  isSectionChanging,
  onSectionReady,
  emptyMessage,
  beforeItems,
  isNavigationDisabled
}) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const handleItemDoubleClick = useCallback(
    item => {
      if (isDirectory(item)) navigateTo(item)
    },
    [navigateTo]
  )

  return (
    <PickerView
      items={source.items ?? []}
      breadcrumbPath={source.breadcrumbPath}
      onBreadcrumbClick={navigateTo}
      fetchStatus={source.fetchStatus}
      hasMore={source.hasMore}
      fetchMore={source.fetchMore}
      isItemDisabled={source.isItemDisabled}
      getItemDisabledReason={source.getItemDisabledReason}
      beforeItems={beforeItems}
      isNavigationDisabled={isNavigationDisabled}
      onItemClick={isMobile ? handleItemDoubleClick : undefined}
      onItemDoubleClick={handleItemDoubleClick}
      onItemNavigate={navigateTo}
      error={error}
      emptyMessage={
        emptyMessage ?? (
          <PickerViewEmptyMessage
            message={
              source.emptyMessageKey ? t(source.emptyMessageKey) : undefined
            }
          />
        )
      }
      isSectionChanging={isSectionChanging}
      onSectionReady={onSectionReady}
    />
  )
}

CurrentFolderContent.propTypes = filePickerContentPropTypes

const SelectionFilePickerContent = ({
  source,
  navigateTo,
  selectableTypes,
  multiple,
  error,
  onFileDoubleClick,
  isSectionChanging,
  onSectionReady,
  emptyMessage,
  beforeItems,
  isNavigationDisabled
}) => {
  const { t } = useI18n()
  const selectionContainerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const [scrollElement, setScrollElement] = useState(null)
  const items = source.items ?? []
  const { isItemDisabled } = source

  const canSelectItem = useCallback(
    item => {
      if (isItemDisabled(item)) return false
      if (isDirectory(item)) {
        return selectableTypes.includes(filePickerItemTypes.FOLDER)
      }

      if (selectableTypes.includes(filePickerItemTypes.FILE)) return true
      return isValidFile(item, selectableTypes)
    },
    [isItemDisabled, selectableTypes]
  )

  const scrollToIndex = useCallback((index, align) => {
    virtuosoRef.current?.scrollToIndex({
      index,
      align,
      behavior: 'auto'
    })
  }, [])

  const pickerAdapter = useFilePickerAdapter({
    items,
    canSelectItem,
    multiple,
    selectionContainerRef,
    scrollElement,
    scrollToIndex,
    navigateTo,
    onFileDoubleClick
  })

  return (
    <PickerView
      selectionContainerRef={selectionContainerRef}
      virtuosoRef={virtuosoRef}
      scrollerRef={setScrollElement}
      items={items}
      breadcrumbPath={source.breadcrumbPath}
      onBreadcrumbClick={navigateTo}
      fetchStatus={source.fetchStatus}
      hasMore={source.hasMore}
      fetchMore={source.fetchMore}
      isFetchingMore={source.isFetchingMore}
      keepItemsOnError={source.keepItemsOnError}
      errorMessageKey={source.errorMessageKey}
      withFilePath={source.withFilePath}
      selectedItemIds={pickerAdapter.selectedItemIds}
      isItemDisabled={isItemDisabled}
      getItemDisabledReason={source.getItemDisabledReason}
      beforeItems={beforeItems}
      isNavigationDisabled={isNavigationDisabled}
      onItemClick={pickerAdapter.onItemClick}
      onItemToggle={pickerAdapter.onItemToggle}
      onItemDoubleClick={pickerAdapter.onItemDoubleClick}
      error={error}
      emptyMessage={
        emptyMessage ?? (
          <PickerViewEmptyMessage
            message={
              source.emptyMessageKey ? t(source.emptyMessageKey) : undefined
            }
          />
        )
      }
      isSectionChanging={isSectionChanging}
      onSectionReady={onSectionReady}
    />
  )
}

SelectionFilePickerContent.propTypes = filePickerContentPropTypes

const FilePickerContent = props =>
  props.mode === filePickerModes.CURRENT_FOLDER ? (
    <CurrentFolderContent {...props} />
  ) : (
    <SelectionFilePickerContent {...props} />
  )

FilePickerContent.propTypes = filePickerContentPropTypes

const LocalFolderContent = ({
  folderId,
  displayedTypes,
  rootBreadcrumbPath,
  sharedDocumentIds,
  isItemDisabled,
  isItemIncluded,
  filterReceivedShares,
  allLoaded,
  isOwner,
  onReady,
  renderFilePickerContent,
  getItemDisabledReason,
  additionalItems,
  sortOrder
}) => {
  const buildFolderQuery = id =>
    buildDisplayedContentFolderQuery(id, displayedTypes, sortOrder)
  const source = useLocalFolderBrowser({
    folderId,
    rootBreadcrumbPath,
    sharedDocumentIds,
    buildFolderQuery,
    filterReceivedShares,
    allLoaded,
    isOwner,
    onReady,
    isItemDisabled,
    getItemDisabledReason
  })
  const items = useMemo(() => {
    const sourceItems = source.items ?? []
    const sourceIds = new Set(sourceItems.map(item => item._id ?? item.id))
    const addedItems = additionalItems.filter(
      item => item?.dir_id === folderId && !sourceIds.has(item._id ?? item.id)
    )
    const visibleItems = [...sourceItems, ...addedItems].filter(
      item => isItemTypeDisplayed(item, displayedTypes) && isItemIncluded(item)
    )
    return additionalItems.length > 0
      ? sortFiles(visibleItems, sortOrder)
      : visibleItems
  }, [
    additionalItems,
    displayedTypes,
    folderId,
    isItemIncluded,
    sortOrder,
    source.items
  ])

  return renderFilePickerContent({
    ...source,
    items
  })
}

LocalFolderContent.propTypes = {
  folderId: PropTypes.string.isRequired,
  displayedTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  rootBreadcrumbPath: PropTypes.object.isRequired,
  sharedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  isItemDisabled: PropTypes.func.isRequired,
  isItemIncluded: PropTypes.func.isRequired,
  filterReceivedShares: PropTypes.bool.isRequired,
  allLoaded: PropTypes.bool.isRequired,
  isOwner: PropTypes.func.isRequired,
  onReady: PropTypes.func,
  renderFilePickerContent: PropTypes.func.isRequired,
  getItemDisabledReason: PropTypes.func.isRequired,
  additionalItems: PropTypes.arrayOf(PropTypes.object),
  sortOrder: PropTypes.shape({
    attribute: PropTypes.string.isRequired,
    order: PropTypes.string.isRequired
  }).isRequired
}

const SharedDriveFolderContent = ({
  driveId,
  folderId,
  displayedTypes,
  rootBreadcrumbPath,
  sharedDocumentIds,
  isItemDisabled,
  getItemDisabledReason,
  isItemIncluded,
  renderFilePickerContent,
  additionalItems,
  sortOrder
}) => {
  const path = useBreadcrumbPath({
    currentFolderId: folderId,
    rootBreadcrumbPath,
    sharedDocumentIds,
    driveId
  })
  const { sharedDriveResult, fetchStatus, hasMore, fetchMore } =
    useSharedDriveFolder({ driveId, folderId })
  const items = useMemo(() => {
    const sourceItems = (sharedDriveResult.included ?? []).map(item => ({
      ...item,
      driveId
    }))
    const sourceIds = new Set(sourceItems.map(item => item._id ?? item.id))
    const addedItems = additionalItems.filter(
      item =>
        item?.dir_id === folderId &&
        item.driveId === driveId &&
        !sourceIds.has(item._id ?? item.id)
    )
    return sortFiles(
      [...sourceItems, ...addedItems]
        .filter(item => isItemTypeDisplayed(item, displayedTypes))
        .filter(isItemIncluded),
      sortOrder
    )
  }, [
    additionalItems,
    displayedTypes,
    driveId,
    folderId,
    isItemIncluded,
    sharedDriveResult.included,
    sortOrder
  ])

  return renderFilePickerContent({
    items,
    fetchStatus,
    hasMore,
    fetchMore,
    breadcrumbPath: path,
    isItemDisabled,
    getItemDisabledReason
  })
}

SharedDriveFolderContent.propTypes = {
  driveId: PropTypes.string.isRequired,
  folderId: PropTypes.string.isRequired,
  displayedTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  rootBreadcrumbPath: PropTypes.object.isRequired,
  sharedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  isItemDisabled: PropTypes.func.isRequired,
  getItemDisabledReason: PropTypes.func,
  isItemIncluded: PropTypes.func.isRequired,
  renderFilePickerContent: PropTypes.func.isRequired,
  additionalItems: PropTypes.arrayOf(PropTypes.object),
  sortOrder: PropTypes.shape({
    attribute: PropTypes.string.isRequired,
    order: PropTypes.string.isRequired
  }).isRequired
}

export const FilePickerBody = ({
  mode,
  navigateTo,
  section,
  folderId,
  driveId,
  displayedTypes,
  selectableTypes,
  multiple,
  error,
  onReadyToUse,
  onFileDoubleClick,
  isItemIncluded,
  isItemDisabled: externalIsItemDisabled,
  getItemDisabledReason: externalGetItemDisabledReason,
  beforeItems,
  additionalItems,
  filterReceivedShares,
  isNavigationDisabled,
  isSectionChanging,
  onSectionReady,
  sortOrder
}) => {
  const { t } = useI18n()
  const { allLoaded, byDocId, isOwner } = useSharingContext()
  const readyNotified = useRef(false)
  const sharedDocumentIds = useMemo(() => Object.keys(byDocId ?? {}), [byDocId])
  const rootBreadcrumbPath = useMemo(
    () => ({
      id:
        section === filePickerSections.DRIVE
          ? ROOT_DIR_ID
          : section === filePickerSections.RECENTS
            ? FILE_PICKER_RECENTS_ROOT_ID
            : FILE_PICKER_SHARINGS_ROOT_ID,
      name: t(
        section === filePickerSections.DRIVE
          ? 'Nav.item_drive'
          : section === filePickerSections.RECENTS
            ? 'Nav.item_recent'
            : 'Nav.item_sharings'
      )
    }),
    [section, t]
  )

  const isItemDisabled = item =>
    (section === filePickerSections.SHARINGS && isSharingShortcutNew(item)) ||
    Boolean(externalGetItemDisabledReason(item)) ||
    externalIsItemDisabled(item)

  const handleDriveReady = useCallback(() => {
    if (readyNotified.current) return
    readyNotified.current = true
    onReadyToUse?.()
  }, [onReadyToUse])

  const renderFilePickerContent = source => (
    <FilePickerContent
      source={source}
      mode={mode}
      navigateTo={navigateTo}
      selectableTypes={selectableTypes}
      multiple={multiple}
      error={error}
      emptyMessage={
        section === filePickerSections.SHARINGS &&
        folderId === FILE_PICKER_SHARINGS_ROOT_ID ? (
          <PickerViewEmptyMessage message={t('empty.sharing_text')} />
        ) : null
      }
      onFileDoubleClick={onFileDoubleClick}
      beforeItems={beforeItems}
      isNavigationDisabled={isNavigationDisabled}
      isSectionChanging={isSectionChanging}
      onSectionReady={onSectionReady}
    />
  )

  if (
    section === filePickerSections.RECENTS &&
    folderId === FILE_PICKER_RECENTS_ROOT_ID
  ) {
    return (
      <FilePickerRecentsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        isItemDisabled={isItemDisabled}
        getItemDisabledReason={externalGetItemDisabledReason}
        renderContent={renderFilePickerContent}
      />
    )
  }

  if (
    section === filePickerSections.SHARINGS &&
    folderId === FILE_PICKER_SHARINGS_ROOT_ID
  ) {
    return (
      <FilePickerSharingsContent
        displayedTypes={displayedTypes}
        rootBreadcrumbPath={rootBreadcrumbPath}
        sharedDocumentIds={sharedDocumentIds}
        isItemIncluded={isItemIncluded}
        isItemDisabled={isItemDisabled}
        getItemDisabledReason={externalGetItemDisabledReason}
        sortOrder={sortOrder}
        renderFilePickerContent={renderFilePickerContent}
      />
    )
  }

  if (driveId) {
    return (
      <SharedDriveFolderContent
        driveId={driveId}
        folderId={folderId}
        displayedTypes={displayedTypes}
        rootBreadcrumbPath={rootBreadcrumbPath}
        sharedDocumentIds={sharedDocumentIds}
        isItemDisabled={isItemDisabled}
        getItemDisabledReason={externalGetItemDisabledReason}
        isItemIncluded={isItemIncluded}
        additionalItems={additionalItems}
        sortOrder={sortOrder}
        renderFilePickerContent={renderFilePickerContent}
      />
    )
  }

  return (
    <LocalFolderContent
      folderId={folderId}
      displayedTypes={displayedTypes}
      rootBreadcrumbPath={rootBreadcrumbPath}
      sharedDocumentIds={
        section === filePickerSections.SHARINGS ? sharedDocumentIds : undefined
      }
      isItemDisabled={isItemDisabled}
      isItemIncluded={isItemIncluded}
      getItemDisabledReason={externalGetItemDisabledReason}
      filterReceivedShares={
        filterReceivedShares && section === filePickerSections.DRIVE
      }
      allLoaded={allLoaded === true}
      isOwner={isOwner}
      onReady={
        section === filePickerSections.DRIVE ? handleDriveReady : undefined
      }
      renderFilePickerContent={renderFilePickerContent}
      additionalItems={additionalItems}
      sortOrder={sortOrder}
    />
  )
}

FilePickerBody.propTypes = {
  mode: PropTypes.oneOf(Object.values(filePickerModes)).isRequired,
  section: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  folderId: PropTypes.string.isRequired,
  driveId: PropTypes.string,
  navigateTo: PropTypes.func.isRequired,
  displayedTypes: PropTypes.arrayOf(
    PropTypes.oneOf(Object.values(filePickerItemTypes))
  ).isRequired,
  selectableTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  error: PropTypes.string,
  onReadyToUse: PropTypes.func,
  onFileDoubleClick: PropTypes.func,
  isItemIncluded: PropTypes.func.isRequired,
  isItemDisabled: PropTypes.func,
  getItemDisabledReason: PropTypes.func,
  sortOrder: PropTypes.shape({
    attribute: PropTypes.string.isRequired,
    order: PropTypes.string.isRequired
  }).isRequired,
  beforeItems: PropTypes.node,
  additionalItems: PropTypes.arrayOf(PropTypes.object),
  filterReceivedShares: PropTypes.bool,
  isNavigationDisabled: PropTypes.bool,
  isSectionChanging: PropTypes.bool,
  onSectionReady: PropTypes.func
}

FilePickerBody.defaultProps = {
  driveId: null,
  multiple: false,
  error: null,
  isItemIncluded: () => true,
  isItemDisabled: () => false,
  getItemDisabledReason: () => null,
  sortOrder: DEFAULT_SORT,
  beforeItems: null,
  additionalItems: [],
  filterReceivedShares: true,
  isSectionChanging: false
}
