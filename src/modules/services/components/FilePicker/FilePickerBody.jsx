import PropTypes from 'prop-types'
import React, { useCallback, useMemo, useRef, useState } from 'react'

import { models } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'
import { useI18n } from 'twake-i18n'

import { FilePickerRecentsContent } from './FilePickerRecentsContent'
import { FilePickerSharingsContent } from './FilePickerSharingsContent'
import {
  filePickerSections,
  FILE_PICKER_RECENTS_ROOT_ID,
  FILE_PICKER_SHARINGS_ROOT_ID
} from './constants'
import { isValidFile } from './helpers'
import { buildContentFolderQuery } from './queries'
import { useFilePickerAdapter } from './useFilePickerAdapter'

import { EmptyMessage as PickerViewEmptyMessage } from '@/components/PickerView/EmptyMessage'
import { PickerView } from '@/components/PickerView/PickerView'
import { useLocalFolderBrowser } from '@/components/PickerView/useLocalFolderBrowser'
import { ROOT_DIR_ID } from '@/constants/config'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'

const {
  file: { isDirectory }
} = models

const FilePickerContent = ({
  source,
  navigateTo,
  itemTypesAccepted,
  multiple,
  error,
  onFileDoubleClick,
  isSectionChanging,
  onSectionReady,
  emptyMessage
}) => {
  const selectionContainerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const [scrollElement, setScrollElement] = useState(null)
  const items = source.items ?? []
  const { isItemDisabled } = source

  const canSelectItem = useCallback(
    item =>
      !isItemDisabled(item) &&
      (isDirectory(item) || isValidFile(item, itemTypesAccepted)),
    [isItemDisabled, itemTypesAccepted]
  )

  const scrollToIndex = useCallback((index, align) => {
    virtuosoRef.current?.scrollToIndex({
      index,
      align,
      behavior: 'auto'
    })
  }, [])

  const { selectedItemIds, onItemClick, onItemToggle, onItemDoubleClick } =
    useFilePickerAdapter({
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
      selectedItemIds={selectedItemIds}
      isFetchingMore={source.isFetchingMore}
      keepItemsOnError={source.keepItemsOnError}
      errorMessageKey={source.errorMessageKey}
      withFilePath={source.withFilePath}
      isItemDisabled={isItemDisabled}
      onItemClick={onItemClick}
      onItemToggle={onItemToggle}
      onItemDoubleClick={onItemDoubleClick}
      error={error}
      emptyMessage={
        emptyMessage ?? (
          <PickerViewEmptyMessage
            messageKey={source.emptyMessageKey ?? 'empty.title'}
          />
        )
      }
      isSectionChanging={isSectionChanging}
      onSectionReady={onSectionReady}
    />
  )
}

FilePickerContent.propTypes = {
  source: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    fetchStatus: PropTypes.string.isRequired,
    hasMore: PropTypes.bool,
    fetchMore: PropTypes.func,
    breadcrumbPath: PropTypes.array,
    isItemDisabled: PropTypes.func.isRequired,
    withFilePath: PropTypes.bool,
    isFetchingMore: PropTypes.bool,
    keepItemsOnError: PropTypes.bool,
    emptyMessageKey: PropTypes.string,
    errorMessageKey: PropTypes.string
  }).isRequired,
  navigateTo: PropTypes.func.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  error: PropTypes.string,
  onFileDoubleClick: PropTypes.func,
  isSectionChanging: PropTypes.bool,
  onSectionReady: PropTypes.func,
  emptyMessage: PropTypes.node
}

const LocalFolderContent = ({
  folderId,
  rootBreadcrumbPath,
  sharedDocumentIds,
  isItemDisabled,
  filterReceivedShares,
  allLoaded,
  isOwner,
  onReady,
  renderFilePickerContent
}) => {
  const source = useLocalFolderBrowser({
    folderId,
    rootBreadcrumbPath,
    sharedDocumentIds,
    buildFolderQuery: buildContentFolderQuery,
    filterReceivedShares,
    allLoaded,
    isOwner,
    onReady,
    isItemDisabled
  })

  return renderFilePickerContent(source)
}

LocalFolderContent.propTypes = {
  folderId: PropTypes.string.isRequired,
  rootBreadcrumbPath: PropTypes.object.isRequired,
  sharedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  isItemDisabled: PropTypes.func.isRequired,
  filterReceivedShares: PropTypes.bool.isRequired,
  allLoaded: PropTypes.bool.isRequired,
  isOwner: PropTypes.func.isRequired,
  onReady: PropTypes.func,
  renderFilePickerContent: PropTypes.func.isRequired
}

const SharedDriveFolderContent = ({
  driveId,
  folderId,
  rootBreadcrumbPath,
  sharedDocumentIds,
  isItemDisabled,
  renderFilePickerContent
}) => {
  const path = useBreadcrumbPath({
    currentFolderId: folderId,
    rootBreadcrumbPath,
    sharedDocumentIds,
    driveId
  })
  const { sharedDriveResult, fetchStatus, hasMore, fetchMore } =
    useSharedDriveFolder({ driveId, folderId })
  const items = useMemo(
    () =>
      (sharedDriveResult.included ?? []).map(item => ({ ...item, driveId })),
    [driveId, sharedDriveResult.included]
  )

  return renderFilePickerContent({
    items,
    fetchStatus,
    hasMore,
    fetchMore,
    breadcrumbPath: path,
    isItemDisabled
  })
}

SharedDriveFolderContent.propTypes = {
  driveId: PropTypes.string.isRequired,
  folderId: PropTypes.string.isRequired,
  rootBreadcrumbPath: PropTypes.object.isRequired,
  sharedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  isItemDisabled: PropTypes.func.isRequired,
  renderFilePickerContent: PropTypes.func.isRequired
}

const FilePickerBody = ({
  navigateTo,
  section,
  folderId,
  driveId,
  itemTypesAccepted,
  multiple,
  error,
  onReadyToUse,
  onFileDoubleClick,
  isSectionChanging,
  onSectionReady
}) => {
  const { t } = useI18n()
  const { allLoaded, byDocId, isOwner } = useSharingContext()
  const readyNotified = useRef(false)
  const sharedDocumentIds = useMemo(() => Object.keys(byDocId ?? {}), [byDocId])
  const rootBreadcrumbPath = useMemo(() => {
    if (section === filePickerSections.DRIVE) {
      return { id: ROOT_DIR_ID, name: t('Nav.item_drive') }
    }
    if (section === filePickerSections.RECENTS) {
      return {
        id: FILE_PICKER_RECENTS_ROOT_ID,
        name: t('Nav.item_recent')
      }
    }
    return {
      id: FILE_PICKER_SHARINGS_ROOT_ID,
      name: t('Nav.item_sharings')
    }
  }, [section, t])

  const isItemDisabled =
    section === filePickerSections.SHARINGS ? isSharingShortcutNew : () => false
  const emptyMessageKey =
    section === filePickerSections.SHARINGS &&
    folderId === FILE_PICKER_SHARINGS_ROOT_ID
      ? 'empty.sharing_text'
      : 'empty.title'

  const handleDriveReady = useCallback(() => {
    if (readyNotified.current) return
    readyNotified.current = true
    onReadyToUse?.()
  }, [onReadyToUse])

  const renderFilePickerContent = source => (
    <FilePickerContent
      source={source}
      navigateTo={navigateTo}
      itemTypesAccepted={itemTypesAccepted}
      multiple={multiple}
      error={error}
      emptyMessage={
        section === filePickerSections.SHARINGS &&
        folderId === FILE_PICKER_SHARINGS_ROOT_ID ? (
          <PickerViewEmptyMessage messageKey={emptyMessageKey} />
        ) : null
      }
      onFileDoubleClick={onFileDoubleClick}
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
        rootBreadcrumbPath={rootBreadcrumbPath}
        sharedDocumentIds={sharedDocumentIds}
        renderFilePickerContent={renderFilePickerContent}
      />
    )
  }

  if (driveId) {
    return (
      <SharedDriveFolderContent
        driveId={driveId}
        folderId={folderId}
        rootBreadcrumbPath={rootBreadcrumbPath}
        sharedDocumentIds={sharedDocumentIds}
        isItemDisabled={isItemDisabled}
        renderFilePickerContent={renderFilePickerContent}
      />
    )
  }

  return (
    <LocalFolderContent
      folderId={folderId}
      rootBreadcrumbPath={rootBreadcrumbPath}
      sharedDocumentIds={
        section === filePickerSections.SHARINGS ? sharedDocumentIds : undefined
      }
      isItemDisabled={isItemDisabled}
      filterReceivedShares={section === filePickerSections.DRIVE}
      allLoaded={allLoaded === true}
      isOwner={isOwner}
      onReady={
        section === filePickerSections.DRIVE ? handleDriveReady : undefined
      }
      renderFilePickerContent={renderFilePickerContent}
    />
  )
}

FilePickerBody.propTypes = {
  section: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  folderId: PropTypes.string.isRequired,
  driveId: PropTypes.string,
  navigateTo: PropTypes.func.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  error: PropTypes.string,
  onReadyToUse: PropTypes.func,
  onFileDoubleClick: PropTypes.func,
  isSectionChanging: PropTypes.bool,
  onSectionReady: PropTypes.func
}

FilePickerBody.defaultProps = {
  driveId: null,
  multiple: false,
  error: null,
  isSectionChanging: false
}

export default FilePickerBody
