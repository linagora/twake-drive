import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import {
  stableSort,
  getComparator
} from 'cozy-ui/transpiled/react/Table/Virtualized/helpers'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import Grid from './Grid'
import { secondarySort } from '../helpers'
import { useSyncingFakeFile } from '../useSyncingFakeFile'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { useShiftSelection } from '@/hooks/useShiftSelection'
import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import { isTypingNewFolderName } from '@/modules/filelist/duck'
import { FolderUnlocker } from '@/modules/folder/components/FolderUnlocker'
import { useCancelable } from '@/modules/move/hooks/useCancelable'
import RectangularSelection from '@/modules/selection/RectangularSelection'
import SelectionBar from '@/modules/selection/SelectionBar'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import Table from '@/modules/views/Folder/virtualized/Table'
import { makeRows, onDrop } from '@/modules/views/Folder/virtualized/helpers'

const FolderViewBodyContent = ({
  currentFolderId,
  displayedFolder,
  actions,
  columns,
  queryResults,
  isEmpty,
  canDrag,
  withFilePath,
  driveId,
  orderProps = {
    sortOrder: {},
    setOrder: () => {}
  },
  refreshFolderContent
}) => {
  const folderViewRef = useRef()
  // Stores the actual scroll container HTMLElement from virtuoso's scrollerRef callback.
  // This is needed because virtuosoRef.current only exposes the handle API (scrollTo, scrollBy, etc.),
  // not the DOM element required for RectangularSelection's auto-scroll functionality.
  const [scrollElement, setScrollElement] = useState(null)
  // Ref to store the virtuoso imperative handle (scrollTo, scrollToIndex, etc.).
  // Note: This is a plain ref and does not trigger re-renders on assignment.
  // Consumers should access virtuosoRef.current when needed (e.g., in effects
  // triggered by other state changes like highlightedItems).
  const virtuosoRef = useRef(null)

  const client = useClient()

  const navigate = useNavigate()

  const { selectAll, selectedItems } = useSelectionContext()
  const { sharedPaths } = useSharingContext()
  const { registerCancelable } = useCancelable()
  const { showAlert } = useAlert()
  const { viewType } = useViewSwitcherContext()
  const { t } = useI18n()
  const IsAddingFolder = useSelector(isTypingNewFolderName)
  const { sortOrder } = orderProps
  const { order, attribute: orderBy } = sortOrder

  const fetchMore = queryResults.find(query => query.hasMore)?.fetchMore

  const isSelectedItem = file => {
    if (file._id === SHARED_DRIVES_DIR_ID) {
      return false
    }
    return selectedItems.some(item => item._id === file._id)
  }

  const { syncingFakeFile } = useSyncingFakeFile({ isEmpty, queryResults })

  const rows = useMemo(
    () => makeRows({ queryResults, IsAddingFolder, syncingFakeFile }),
    [queryResults, IsAddingFolder, syncingFakeFile]
  )

  const sortedRows = useMemo(() => {
    const sortedData = stableSort(rows, getComparator(order, orderBy))
    return secondarySort(sortedData)
  }, [rows, order, orderBy])

  const { setLastInteractedItem, onShiftClick } = useShiftSelection(
    {
      items: sortedRows,
      viewType
    },
    folderViewRef
  )

  const onInteractWithFile = (itemId, event) => {
    setLastInteractedItem(itemId)
    onShiftClick(itemId, event)
  }

  const handleFolderUnlockerDismiss = useCallback(() => {
    navigate('/folder')
  }, [navigate])

  const isDynamicSelectionEnabled = flag('drive.dynamic-selection.enabled')

  const dragProps = useMemo(
    () => ({
      enabled: canDrag,
      dragId: 'drag-drive',
      onDrop: onDrop({
        client,
        showAlert,
        selectAll,
        registerCancelable,
        sharedPaths,
        t,
        refreshFolderContent,
        displayedFolder
      })
    }),
    [
      canDrag,
      client,
      showAlert,
      selectAll,
      registerCancelable,
      sharedPaths,
      t,
      refreshFolderContent,
      displayedFolder
    ]
  )

  const tableComponent = (
    <Table
      rows={sortedRows}
      columns={columns}
      dragProps={dragProps}
      fetchMore={fetchMore}
      selectAll={selectAll}
      isSelectedItem={isSelectedItem}
      selectedItems={selectedItems}
      currentFolderId={currentFolderId}
      withFilePath={withFilePath}
      actions={actions}
      driveId={driveId}
      ref={folderViewRef}
      virtuosoRef={virtuosoRef}
      scrollerRef={setScrollElement}
      onInteractWithFile={onInteractWithFile}
      orderProps={orderProps}
      refreshFolderContent={refreshFolderContent}
    />
  )

  const gridComponent = (
    <Grid
      items={sortedRows}
      currentFolderId={currentFolderId}
      withFilePath={withFilePath}
      actions={actions}
      fetchMore={fetchMore}
      selectedItems={selectedItems}
      isSelectedItem={isSelectedItem}
      driveId={driveId}
      dragProps={dragProps}
      onInteractWithFile={onInteractWithFile}
      ref={folderViewRef}
      virtuosoRef={virtuosoRef}
      scrollerRef={setScrollElement}
      refreshFolderContent={refreshFolderContent}
    />
  )

  const viewContent = viewType === 'list' ? tableComponent : gridComponent

  return (
    <FolderUnlocker
      folder={displayedFolder}
      onDismiss={handleFolderUnlockerDismiss}
    >
      <SelectionBar actions={actions} />
      {isDynamicSelectionEnabled ? (
        <RectangularSelection
          items={sortedRows}
          scrollContainerRef={folderViewRef}
          scrollElement={scrollElement}
        >
          {viewContent}
        </RectangularSelection>
      ) : (
        viewContent
      )}
    </FolderUnlocker>
  )
}

export default FolderViewBodyContent
