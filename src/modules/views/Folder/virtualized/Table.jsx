import cx from 'classnames'
import React, {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react'
import { useSelector } from 'react-redux'

import VirtualizedTable from 'cozy-ui/transpiled/react/Table/Virtualized'
import virtuosoComponents from 'cozy-ui/transpiled/react/Table/Virtualized/virtuosoComponents'

import TableRow from './TableRow'
import CustomDragLayer from './dnd/CustomDragLayer'
import TableScroller from './dnd/TableScroller'

import styles from '@/styles/filelist.styl'

import { isRenaming as isRenamingSelector } from '@/modules/drive/rename'
import { isUnreadableRecent } from '@/modules/filelist/helpers'
import Cell from '@/modules/filelist/virtualized/cells/Cell'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'
import useScrollToHighlightedItem from '@/modules/views/Folder/virtualized/useScrollToHighlightedItem'

const components = {
  ...virtuosoComponents,
  Scroller: TableScroller,
  TableRow
}

const Table = forwardRef(
  (
    {
      rows,
      columns,
      dragProps,
      fetchMore,
      isSelectedItem,
      selectedItems,
      currentFolderId,
      withFilePath,
      actions,
      driveId,
      orderProps = {
        sortOrder: {},
        setOrder: () => {}
      },
      onInteractWithFile,
      refreshFolderContent,
      virtuosoRef: parentVirtuosoRef,
      scrollerRef
    },
    ref
  ) => {
    const { setSelectedItems } = useSelectionContext()
    const { isNew } = useNewItemHighlightContext()
    const isRenamingActive = useSelector(isRenamingSelector)
    const internalVirtuosoRef = useRef(null)
    const virtuosoRef = parentVirtuosoRef || internalVirtuosoRef
    const [itemsInDropProcess, setItemsInDropProcess] = useState([])

    const { sortOrder, setOrder } = orderProps

    // cozy-ui invokes this with (row, column) and no DOM event, so modifier
    // keys aren't available here: clicking the row body always selects just
    // that row. Multi-select (ctrl/cmd-click, shift-range) goes through the
    // name cell's FileOpener, which does receive the real event.
    const handleRowSelect = useCallback(
      (row, column) => {
        if (isRenamingActive || isUnreadableRecent(row)) return
        setSelectedItems({ [row._id]: row })
        onInteractWithFile?.(row?._id, column)
      },
      [onInteractWithFile, setSelectedItems, isRenamingActive]
    )

    const handleSort = ({ order, orderBy }) => {
      setOrder({
        order,
        attribute: orderBy
      })
    }

    const tableContext = useMemo(
      () => ({
        actions,
        selectedItems,
        isSelectedItem,
        dragProps,
        itemsInDropProcess,
        setItemsInDropProcess
      }),
      [actions, selectedItems, isSelectedItem, dragProps, itemsInDropProcess]
    )

    // Memoize componentsProps to avoid recreating the Cell component on every render
    // This follows Virtuoso's recommendation to not define custom components inline
    const componentsProps = useMemo(
      () => ({
        rowContent: {
          onClick: handleRowSelect,
          children: (
            <Cell
              currentFolderId={currentFolderId}
              withFilePath={withFilePath}
              actions={actions}
              onInteractWithFile={onInteractWithFile}
              refreshFolderContent={refreshFolderContent}
              driveId={driveId}
            />
          )
        }
      }),
      [
        handleRowSelect,
        currentFolderId,
        withFilePath,
        actions,
        onInteractWithFile,
        refreshFolderContent,
        driveId
      ]
    )

    useScrollToHighlightedItem(virtuosoRef, rows)

    return (
      <div
        className={cx('u-h-100', 'u-pl-1', styles['fil-file-list-container'])}
        ref={ref}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        {dragProps?.dragId && <CustomDragLayer dragId={dragProps.dragId} />}
        <VirtualizedTable
          ref={virtuosoRef}
          scrollerRef={scrollerRef}
          context={tableContext}
          components={components}
          rows={rows}
          columns={columns}
          endReached={fetchMore}
          defaultOrder={{
            direction: sortOrder.order,
            by: sortOrder.attribute
          }}
          sortingMode="server"
          isSelectedItem={isSelectedItem}
          isNewItem={isNew}
          selectedItems={selectedItems}
          increaseViewportBy={200}
          onSortChange={handleSort}
          componentsProps={componentsProps}
        />
      </div>
    )
  }
)

Table.displayName = 'Table'

export default React.memo(Table)
