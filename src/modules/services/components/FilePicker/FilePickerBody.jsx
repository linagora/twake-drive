import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { models, useQuery } from 'cozy-client'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Box from 'cozy-ui/transpiled/react/Box'
import { useI18n } from 'twake-i18n'

import FilePickerBreadcrumb from './FilePickerBreadcrumb'
import { FilePickerTable } from './FilePickerTable'
import { isValidFile } from './helpers'
import { buildContentFolderQuery } from './queries'
import styles from './styles.styl'
import { useFilePickerSelection } from './useFilePickerSelection'

import { ROOT_DIR_ID } from '@/constants/config'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'

const {
  file: { isDirectory }
} = models

const FilePickerBody = ({
  navigateTo,
  folderId,
  itemTypesAccepted,
  multiple,
  folderSelectable,
  error,
  onReadyToUse
}) => {
  const { t } = useI18n()
  const selectionContainerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const [scrollElement, setScrollElement] = useState(null)
  const rootBreadcrumbPath = useMemo(
    () => ({ id: ROOT_DIR_ID, name: t('Nav.item_drive') }),
    [t]
  )
  const path = useBreadcrumbPath({
    currentFolderId: folderId,
    rootBreadcrumbPath
  })
  const contentFolderQuery = buildContentFolderQuery(folderId)
  const {
    data: contentFolder,
    isLoading,
    hasMore,
    fetchMore
  } = useQuery(contentFolderQuery.definition, contentFolderQuery.options)
  const items = contentFolder || []

  useEffect(() => {
    if (isLoading) return
    onReadyToUse?.()
  }, [isLoading, onReadyToUse])

  const canSelectItem = useCallback(
    item =>
      (folderSelectable && isDirectory(item)) ||
      isValidFile(item, itemTypesAccepted),
    [folderSelectable, itemTypesAccepted]
  )

  const scrollToIndex = useCallback((index, align) => {
    virtuosoRef.current?.scrollToIndex({
      index,
      align,
      behavior: 'auto'
    })
  }, [])

  const { handleItemClick, selectedItemIds } = useFilePickerSelection({
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
      }
    },
    [navigateTo]
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
      <Box px={3} py={1}>
        <FilePickerBreadcrumb path={path} onBreadcrumbClick={navigateTo} />
      </Box>
      <FilePickerTable
        items={items}
        itemsIdsSelected={selectedItemIds}
        onItemClick={handleItemClick}
        onItemDoubleClick={handleListItemDoubleClick}
        fetchMore={hasMore ? fetchMore : undefined}
        scrollerRef={setScrollElement}
        virtuosoRef={virtuosoRef}
      />
    </Box>
  )
}

FilePickerBody.propTypes = {
  folderId: PropTypes.string.isRequired,
  navigateTo: PropTypes.func.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  folderSelectable: PropTypes.bool,
  error: PropTypes.string,
  onReadyToUse: PropTypes.func
}

FilePickerBody.defaultProps = {
  multiple: false,
  folderSelectable: false,
  error: null
}

export default FilePickerBody
