import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isQueryLoading, models, useQuery } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Box from 'cozy-ui/transpiled/react/Box'
import ListItemSkeleton from 'cozy-ui/transpiled/react/Skeletons/ListItemSkeleton'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

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
  onFileDoubleClick
}) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const selectionContainerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const [scrollElement, setScrollElement] = useState(null)
  const items = source.items ?? []
  const { isItemDisabled } = source

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

  const emptyMessageKey =
    section === filePickerSections.SHARINGS
      ? 'empty.sharing_text'
      : 'empty.title'

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
      {source.fetchStatus === 'failed' ? (
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
        <Typography
          className="u-ta-center u-pa-2"
          color="textSecondary"
          data-testid="file-picker-empty"
        >
          {t(emptyMessageKey)}
        </Typography>
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
  onFileDoubleClick: PropTypes.func
}

const LocalFolderContent = ({
  folderId,
  rootBreadcrumbPath,
  sharedDocumentIds,
  isItemDisabled,
  onReady,
  renderContent
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
  const fetchStatus = isQueryLoading(result)
    ? 'loading'
    : (result.fetchStatus ?? 'loaded')

  useEffect(() => {
    if (fetchStatus !== 'loading') onReady?.()
  }, [fetchStatus, onReady])

  return renderContent({
    items: result.data ?? [],
    fetchStatus,
    hasMore: Boolean(result.hasMore),
    fetchMore: result.fetchMore ?? null,
    breadcrumbPath: path,
    isItemDisabled
  })
}

LocalFolderContent.propTypes = {
  folderId: PropTypes.string.isRequired,
  rootBreadcrumbPath: PropTypes.object.isRequired,
  sharedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  isItemDisabled: PropTypes.func.isRequired,
  onReady: PropTypes.func,
  renderContent: PropTypes.func.isRequired
}

const SharedDriveFolderContent = ({
  driveId,
  folderId,
  rootBreadcrumbPath,
  sharedDocumentIds,
  isItemDisabled,
  renderContent
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

  return renderContent({
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
  renderContent: PropTypes.func.isRequired
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
  onFileDoubleClick
}) => {
  const { t } = useI18n()
  const { byDocId } = useSharingContext()
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

  const renderContent = useCallback(
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
      />
    ),
    [
      error,
      folderSelectable,
      itemTypesAccepted,
      multiple,
      navigateTo,
      onFileDoubleClick,
      section
    ]
  )

  if (
    section === filePickerSections.SHARINGS &&
    folderId === FILE_PICKER_SHARINGS_ROOT_ID
  ) {
    return (
      <FilePickerSharingsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        renderContent={renderContent}
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
        renderContent={renderContent}
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
      onReady={
        section === filePickerSections.DRIVE ? handleDriveReady : undefined
      }
      renderContent={renderContent}
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
  onFileDoubleClick: PropTypes.func
}

FilePickerBody.defaultProps = {
  driveId: null,
  multiple: false,
  folderSelectable: false,
  error: null
}

export default FilePickerBody
