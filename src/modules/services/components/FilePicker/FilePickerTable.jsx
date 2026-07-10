import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { forwardRef, memo, useMemo } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import VirtualizedTable from 'cozy-ui/transpiled/react/Table/Virtualized'
import virtuosoComponents from 'cozy-ui/transpiled/react/Table/Virtualized/virtuosoComponents'
import TableRow from 'cozy-ui/transpiled/react/TableRow'
import { useI18n } from 'twake-i18n'

import { FilePickerTableCell } from './FilePickerTableCell'

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

    return (
      <TableRow
        {...props}
        ref={ref}
        data-testid="list-item"
        data-file-id={row?._id}
        className={cx(className, 'virtualized')}
        selected={context.isSelectedItem(row)}
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
    isSelectedItem: PropTypes.func.isRequired
  }).isRequired,
  className: PropTypes.string
}

const FilePickerTableRowMemo = memo(FilePickerTableRow)

const tableComponents = {
  ...virtuosoComponents,
  TableRow: FilePickerTableRowMemo
}

const tableComponentsProps = {
  rowContent: {
    children: <FilePickerTableCell />
  }
}

export const FilePickerTable = memo(
  ({ items, itemsIdsSelected, onItemClick, onItemDoubleClick, fetchMore }) => {
    const { t } = useI18n()
    const columns = useMemo(() => makeFilePickerColumns(t), [t])

    const selectedItems = useMemo(
      () => items.filter(item => itemsIdsSelected.includes(item._id)),
      [items, itemsIdsSelected]
    )

    const isSelectedItem = item => {
      return Boolean(item && itemsIdsSelected.includes(item._id))
    }

    const tableContext = useMemo(
      () => ({
        data: items
      }),
      [items]
    )

    const componentsProps = useMemo(
      () => ({
        rowContent: {
          onClick: onItemClick,
          onDoubleClick: onItemDoubleClick,
          children: <FilePickerTableCell />
        }
      }),
      [onItemClick, onItemDoubleClick]
    )
    return (
      <Box height="100%" flex={1} minHeight={0} px={3} boxSizing="border-box">
        <VirtualizedTable
          context={tableContext}
          components={tableComponents}
          rows={items}
          columns={columns}
          endReached={fetchMore}
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
  onItemDoubleClick: PropTypes.func.isRequired,
  fetchMore: PropTypes.func
}
