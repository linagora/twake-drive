import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isQueryLoading, models, useQuery } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Box from 'cozy-ui/transpiled/react/Box'
import ListItemSkeleton from 'cozy-ui/transpiled/react/Skeletons/ListItemSkeleton'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { EmptyMessage } from './EmptyMessage'
import FilePickerBreadcrumb from './FilePickerBreadcrumb'
import { FilePickerSharingsContent } from './FilePickerSharingsContent'
import { FilePickerTable } from './FilePickerTable'
import { filePickerSections, FILE_PICKER_SHARINGS_ROOT_ID } from './constants'
import { isValidFile } from './helpers'
import { buildContentFolderQuery } from './queries'
import styles from './styles.styl'
import { useFilePickerSelection } from './useFilePickerSelection'

import { ROOT_DIR_ID } from '@/constants/config'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { filterOutReceivedShares } from '@/modules/views/Folder/syncHelpers'

const {
  file: { isDirectory }
} = models

const FilePickerContent = ({
  source,
  section,
  navigateTo,
  itemTypesAccepted,
  multiple,
  folderSelectable,
  error,
  onFileDoubleClick,
  isSectionChanging,
  onSectionReady
}) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const selectionContainerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const [scrollElement, setScrollElement] = useState(null)
  const items = source.items ?? []
  const { isItemDisabled } = source
  useEffect(() => {
    if (isSectionChanging && source.fetchStatus !== 'loading') {
      onSectionReady?.()
    }
  }, [isSectionChanging, onSectionReady, source.fetchStatus])

  const canSelectItem = useCallback(
    item =>
      !isItemDisabled(item) &&
      ((folderSelectable && isDirectory(item)) ||
        isValidFile(item, itemTypesAccepted)),
    [folderSelectable, isItemDisabled, itemTypesAccepted]
  )

  const scrollToIndex = useCallback((index, align) => {
    virtuosoRef.current?.scrollToIndex({
      index,
      align,
      behavior: 'auto'
    })
  }, [])

  const { handleItemClick, handleMobileToggleSelect, selectedItemIds } =
    useFilePickerSelection({
      items,
      canSelectItem,
      multiple,
      selectionContainerRef,
      scrollElement,
      scrollToIndex
    })

  const handleListItemDoubleClick = useCallback(
    item => {
      if (isDirectory(item)) {
        navigateTo(item)
      } else if (onFileDoubleClick) {
        onFileDoubleClick(item)
      }
    },
    [navigateTo, onFileDoubleClick]
  )

  const handleMobileItemClick = useCallback(
    (item, event) => {
      if (isDirectory(item)) {
        navigateTo(item)
      } else {
        handleMobileToggleSelect(item, event)
      }
    },
    [handleMobileToggleSelect, navigateTo]
  )

  return (
    <Box
      ref={selectionContainerRef}
      tabIndex={-1}
      className={cx(
        'u-pos-absolute u-top-0 u-right-0 u-bottom-0 u-left-0',
        styles.filePickerSelectionContainer
      )}
      display="flex"
      flexDirection="column"
    >
      {error && (
        <Alert
          severity="error"
          data-testid="file-picker-error"
          className="u-mt-1 u-mh-1"
        >
          {t(`FilePicker.errors.${error}`)}
        </Alert>
      )}
      <Box px={3} py={0} className="u-mt-half">
        <FilePickerBreadcrumb
          path={source.breadcrumbPath}
          onBreadcrumbClick={navigateTo}
        />
      </Box>
      {isSectionChanging ? null : source.fetchStatus === 'failed' ? (
        <Alert
          severity="error"
          data-testid="file-picker-source-error"
          className="u-mt-1 u-mh-1"
        >
          {t('error.open_folder')}
        </Alert>
      ) : source.fetchStatus === 'loading' ? (
        <Box
          px={3}
          role="status"
          aria-label={t('loading.message')}
          data-testid="file-picker-loading"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <ListItemSkeleton key={index} hasSecondary divider={index !== 2} />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <EmptyMessage section={section} />
      ) : (
        <FilePickerTable
          items={items}
          itemsIdsSelected={selectedItemIds}
          isItemDisabled={isItemDisabled}
          onItemClick={isMobile ? handleMobileItemClick : handleItemClick}
          onItemToggle={isMobile ? handleMobileToggleSelect : null}
          onItemDoubleClick={isMobile ? null : handleListItemDoubleClick}
          fetchMore={source.hasMore ? source.fetchMore : null}
          scrollerRef={setScrollElement}
          virtuosoRef={virtuosoRef}
        />
      )}
    </Box>
  )
}

FilePickerContent.propTypes = {
  source: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    fetchStatus: PropTypes.string.isRequired,
    hasMore: PropTypes.bool,
    fetchMore: PropTypes.func,
    breadcrumbPath: PropTypes.array,
    isItemDisabled: PropTypes.func.isRequired
  }).isRequired,
  section: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  navigateTo: PropTypes.func.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  folderSelectable: PropTypes.bool,
  error: PropTypes.string,
  onFileDoubleClick: PropTypes.func,
  isSectionChanging: PropTypes.bool,
  onSectionReady: PropTypes.func
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
  const path = useBreadcrumbPath({
    currentFolderId: folderId,
    rootBreadcrumbPath,
    sharedDocumentIds
  })
  const contentFolderQuery = buildContentFolderQuery(folderId)
  const result = useQuery(
    contentFolderQuery.definition,
    contentFolderQuery.options
  )
  const filteredResult = useMemo(
    () =>
      filterReceivedShares && allLoaded
        ? filterOutReceivedShares([result], isOwner)[0]
        : result,
    [allLoaded, filterReceivedShares, isOwner, result]
  )
  const fetchStatus = isQueryLoading(filteredResult)
    ? 'loading'
    : (filteredResult.fetchStatus ?? 'loaded')

  useEffect(() => {
    if (fetchStatus !== 'loading') onReady?.()
  }, [fetchStatus, onReady])

  return renderFilePickerContent({
    items: filteredResult.data ?? [],
    fetchStatus,
    hasMore: Boolean(filteredResult.hasMore),
    fetchMore: filteredResult.fetchMore ?? null,
    breadcrumbPath: path,
    isItemDisabled
  })
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
  folderSelectable,
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
  const rootBreadcrumbPath = useMemo(
    () => ({
      id:
        section === filePickerSections.DRIVE
          ? ROOT_DIR_ID
          : FILE_PICKER_SHARINGS_ROOT_ID,
      name: t(
        section === filePickerSections.DRIVE
          ? 'Nav.item_drive'
          : 'Nav.item_sharings'
      )
    }),
    [section, t]
  )

  const isItemDisabled =
    section === filePickerSections.SHARINGS ? isSharingShortcutNew : () => false

  const handleDriveReady = useCallback(() => {
    if (readyNotified.current) return
    readyNotified.current = true
    onReadyToUse?.()
  }, [onReadyToUse])

  const renderFilePickerContent = useCallback(
    source => (
      <FilePickerContent
        source={source}
        section={section}
        navigateTo={navigateTo}
        itemTypesAccepted={itemTypesAccepted}
        multiple={multiple}
        folderSelectable={folderSelectable}
        error={error}
        onFileDoubleClick={onFileDoubleClick}
        isSectionChanging={isSectionChanging}
        onSectionReady={onSectionReady}
      />
    ),
    [
      error,
      folderSelectable,
      itemTypesAccepted,
      multiple,
      navigateTo,
      onFileDoubleClick,
      section,
      isSectionChanging,
      onSectionReady
    ]
  )

  if (
    section === filePickerSections.SHARINGS &&
    folderId === FILE_PICKER_SHARINGS_ROOT_ID
  ) {
    return (
      <FilePickerSharingsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
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
  folderSelectable: PropTypes.bool,
  error: PropTypes.string,
  onReadyToUse: PropTypes.func,
  onFileDoubleClick: PropTypes.func,
  isSectionChanging: PropTypes.bool,
  onSectionReady: PropTypes.func
}

FilePickerBody.defaultProps = {
  driveId: null,
  multiple: false,
  folderSelectable: false,
  error: null,
  isSectionChanging: false
}

export default FilePickerBody
