import cx from 'classnames'
import React, {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react'

import flag from 'cozy-flags'
import VirtualizedTable from 'cozy-ui/transpiled/react/Table/Virtualized'
import TableRowDnD from 'cozy-ui/transpiled/react/Table/Virtualized/Dnd/TableRow'
import virtuosoComponentsDnd from 'cozy-ui/transpiled/react/Table/Virtualized/Dnd/virtuosoComponents'
import CustomDragLayer from 'cozy-ui/transpiled/react/utils/Dnd/CustomDrag/CustomDragLayer'

import { secondarySort } from '../helpers'

import styles from '@/styles/filelist.styl'

import RightClickFileMenu from '@/components/RightClick/RightClickFileMenu'
import { useClipboardContext } from '@/contexts/ClipboardProvider'
import Cell from '@/modules/filelist/virtualized/cells/Cell'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'
import useScrollToHighlightedItem from '@/modules/views/Folder/virtualized/useScrollToHighlightedItem'

const TableRow = forwardRef(({ item, context, children, ...props }, ref) => {
  const { isItemCut } = useClipboardContext()
  const isCut = isItemCut(item._id)
  const { actions } = context

  return (
    <RightClickFileMenu doc={item} actions={actions} {...props}>
      <TableRowDnD
        ref={ref}
        item={item}
        context={context}
        componentsProps={{ tableRow: { disabled: isCut } }}
        data-file-id={item._id}
      >
        {children}
      </TableRowDnD>
    </RightClickFileMenu>
  )
})

TableRow.displayName = 'TableRow'

const TableRowMemo = React.memo(TableRow)

const components = {
  ...virtuosoComponentsDnd,
  TableRow: TableRowMemo
}

const Table = forwardRef(
  (
    {
      rows,
      columns,
      dragProps,
      selectAll,
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
      refreshFolderContent
    },
    ref
  ) => {
    const { toggleSelectedItem } = useSelectionContext()
    const { isNew } = useNewItemHighlightContext()
    const virtuosoRef = useRef(null)
    const [itemsInDropProcess, setItemsInDropProcess] = useState([])

    const { sortOrder, setOrder } = orderProps

    const handleRowSelect = useCallback(
      (row, event) => {
        event?.stopPropagation?.()
        toggleSelectedItem(row)
        onInteractWithFile?.(row?._id, event)
      },
      [toggleSelectedItem, onInteractWithFile]
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
        className={cx('u-h-100', styles['fil-file-list-container'])}
        ref={ref}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        {dragProps?.dragId && <CustomDragLayer dragId={dragProps.dragId} />}
        <VirtualizedTable
          ref={virtuosoRef}
          context={tableContext}
          components={components}
          rows={rows}
          columns={columns}
          withCheckbox={!flag('drive.dynamic-selection.enabled')}
          endReached={fetchMore}
          defaultOrder={{
            direction: sortOrder.order,
            by: sortOrder.attribute
          }}
          secondarySort={secondarySort}
          onSelectAll={selectAll}
          onSelect={handleRowSelect}
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
