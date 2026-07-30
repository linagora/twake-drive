import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { forwardRef, memo, useMemo, useRef } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import VirtualizedTable from 'cozy-ui/transpiled/react/Table/Virtualized'
import virtuosoComponents from 'cozy-ui/transpiled/react/Table/Virtualized/virtuosoComponents'
import TableRow from 'cozy-ui/transpiled/react/TableRow'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { FilePickerTableCell } from './FilePickerTableCell'

import { makeMobileHandlers } from '@/hooks/useOnLongPress/helpers'

const makeFilePickerColumns = t => [
  {
    id: 'name',
    label: t('table.head_name'),
    maxWidth: 0,
    sortable: false
  },
  {
    id: 'updated_at',
    label: t('table.head_update'),
    width: 160,
    sortable: false
  },
  {
    id: 'size',
    label: t('table.head_size'),
    width: 100,
    sortable: false
  }
]

const FilePickerTableRow = forwardRef(
  ({ item, context, className, ...props }, ref) => {
    const row = item
    const timerId = useRef()
    const isLongPress = useRef(false)

    const handleClick = event => {
      context.onItemClick(row, event)
    }

    const handleToggle = event => {
      context.onItemToggle(row, event)
    }

    const handleDoubleClick = event => {
      context.onItemDoubleClick?.(row, event)
    }

    let handlers = { onClick: handleClick, onDoubleClick: handleDoubleClick }
    if (context.isMobile) {
      // eslint-disable-next-line react-hooks/refs
      handlers = makeMobileHandlers({
        timerId,
        disabled: false,
        selectionModeActive: context.selectionModeActive,
        isRenaming: false,
        isLongPress,
        openLink: handleClick,
        toggle: handleToggle
      })
    }

    return (
      <TableRow
        {...props}
        ref={ref}
        data-testid="list-item"
        data-file-id={row?._id}
        className={cx(className, 'virtualized', 'u-c-pointer')}
        selected={context.isSelectedItem(row)}
        {...handlers}
        hover
      />
    )
  }
)

FilePickerTableRow.displayName = 'FilePickerTableRow'
FilePickerTableRow.propTypes = {
  item: PropTypes.object,
  context: PropTypes.shape({
    data: PropTypes.array,
    isSelectedItem: PropTypes.func.isRequired,
    isMobile: PropTypes.bool.isRequired,
    selectionModeActive: PropTypes.bool.isRequired,
    onItemClick: PropTypes.func.isRequired,
    onItemToggle: PropTypes.func,
    onItemDoubleClick: PropTypes.func
  }).isRequired,
  className: PropTypes.string
}

const FilePickerTableRowMemo = memo(FilePickerTableRow)

const MobileTableHead = forwardRef(function MobileTableHead(_props, ref) {
  return <thead ref={ref} />
})

const tableComponents = {
  ...virtuosoComponents,
  TableRow: FilePickerTableRowMemo
}

const mobileTableComponents = {
  ...tableComponents,
  TableHead: MobileTableHead
}

export const FilePickerTable = memo(
  ({
    items,
    itemsIdsSelected,
    onItemClick,
    onItemToggle,
    onItemDoubleClick,
    fetchMore,
    scrollerRef,
    virtuosoRef
  }) => {
    const { t } = useI18n()
    const { isMobile } = useBreakpoints()
    const columns = useMemo(() => {
      const filePickerColumns = makeFilePickerColumns(t)
      return isMobile ? filePickerColumns.slice(0, 1) : filePickerColumns
    }, [isMobile, t])

    const selectionModeActive = itemsIdsSelected.length > 0
    const selectedItems = useMemo(
      () => items.filter(item => itemsIdsSelected.includes(item._id)),
      [items, itemsIdsSelected]
    )
    const tableComponentsProps = useMemo(
      () => ({
        rowContent: {
          children: (
            <FilePickerTableCell selectionModeActive={selectionModeActive} />
          )
        }
      }),
      [selectionModeActive]
    )

    const isSelectedItem = item => {
      return Boolean(item && itemsIdsSelected.includes(item._id))
    }

    const tableContext = useMemo(
      () => ({
        data: items,
        isMobile,
        selectionModeActive,
        onItemClick,
        onItemToggle,
        onItemDoubleClick
      }),
      [
        isMobile,
        items,
        selectionModeActive,
        onItemClick,
        onItemDoubleClick,
        onItemToggle
      ]
    )

    return (
      <Box height="100%" flex={1} minHeight={0} px={3} boxSizing="border-box">
        <VirtualizedTable
          ref={virtuosoRef}
          context={tableContext}
          components={isMobile ? mobileTableComponents : tableComponents}
          rows={items}
          columns={columns}
          endReached={fetchMore}
          scrollerRef={scrollerRef}
          selectedItems={selectedItems}
          isSelectedItem={isSelectedItem}
          componentsProps={tableComponentsProps}
        />
      </Box>
    )
  }
)

FilePickerTable.displayName = 'FilePickerTable'
FilePickerTable.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  itemsIdsSelected: PropTypes.arrayOf(PropTypes.string).isRequired,
  onItemClick: PropTypes.func.isRequired,
  onItemToggle: PropTypes.func,
  onItemDoubleClick: PropTypes.func,
  fetchMore: PropTypes.func,
  scrollerRef: PropTypes.func,
  virtuosoRef: PropTypes.object
}
