import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { forwardRef, memo, useCallback, useMemo, useRef } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import VirtualizedTable from 'cozy-ui/transpiled/react/Table/Virtualized'
import virtuosoComponents from 'cozy-ui/transpiled/react/Table/Virtualized/virtuosoComponents'
import TableRow from 'cozy-ui/transpiled/react/TableRow'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { PickerViewTableCell } from './PickerViewTableCell'

import { makeMobileHandlers } from '@/hooks/useOnLongPress/helpers'

export const makePickerViewColumns = t => [
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

export const PickerViewTableRow = forwardRef(
  ({ item, context, className, ...props }, ref) => {
    const row = item
    const timerId = useRef()
    const isLongPress = useRef(false)
    const isDisabled = context.isItemDisabled(row)

    const handleClick = event => {
      if (!isDisabled) context.onItemClick(row, event)
    }

    const handleToggle = event => {
      if (!isDisabled) context.onItemToggle?.(row, event)
    }

    const handleDoubleClick = event => {
      if (!isDisabled) context.onItemDoubleClick?.(row, event)
    }

    let handlers = { onClick: handleClick, onDoubleClick: handleDoubleClick }
    if (context.isMobile) {
      // eslint-disable-next-line react-hooks/refs
      handlers = makeMobileHandlers({
        timerId,
        disabled: isDisabled,
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
        aria-disabled={isDisabled}
        className={cx(
          className,
          'virtualized',
          !isDisabled && 'u-c-pointer',
          isDisabled && 'u-c-default u-o-50'
        )}
        selected={context.isSelectedItem(row)}
        {...handlers}
        hover={!isDisabled}
      />
    )
  }
)

PickerViewTableRow.displayName = 'PickerViewTableRow'
PickerViewTableRow.propTypes = {
  item: PropTypes.object,
  context: PropTypes.shape({
    data: PropTypes.array,
    isSelectedItem: PropTypes.func.isRequired,
    isItemDisabled: PropTypes.func.isRequired,
    isMobile: PropTypes.bool.isRequired,
    selectionModeActive: PropTypes.bool.isRequired,
    onItemClick: PropTypes.func.isRequired,
    onItemToggle: PropTypes.func,
    onItemDoubleClick: PropTypes.func
  }).isRequired,
  className: PropTypes.string
}

export const PickerViewTableRowMemo = memo(PickerViewTableRow)

export const MobileTableHead = forwardRef(
  function MobileTableHead(_props, ref) {
    return <thead ref={ref} />
  }
)

const tableComponents = {
  ...virtuosoComponents,
  TableRow: PickerViewTableRowMemo
}

const mobileTableComponents = {
  ...tableComponents,
  TableHead: MobileTableHead
}

export const PickerViewTable = memo(
  ({
    items = [],
    itemsIdsSelected = [],
    onItemClick = () => {},
    onItemToggle = () => {},
    onItemDoubleClick,
    onItemNavigate,
    isItemDisabled = () => false,
    fetchMore,
    scrollerRef,
    virtuosoRef,
    withFilePath
  }) => {
    const { t } = useI18n()
    const { isMobile } = useBreakpoints()
    const columns = useMemo(() => {
      const defaultColumns = makePickerViewColumns(t)
      return isMobile ? defaultColumns.slice(0, 1) : defaultColumns
    }, [isMobile, t])

    const selectionModeActive = itemsIdsSelected.length > 0
    const isSelectedItem = useCallback(
      item => Boolean(item && itemsIdsSelected.includes(item._id)),
      [itemsIdsSelected]
    )
    const selectedItems = useMemo(
      () => items.filter(isSelectedItem),
      [items, isSelectedItem]
    )
    const tableComponentsProps = useMemo(
      () => ({
        rowContent: {
          children: (
            <PickerViewTableCell
              selectionModeActive={selectionModeActive}
              isSelectedItem={isSelectedItem}
              onItemNavigate={onItemNavigate}
              isItemDisabled={isItemDisabled}
              withFilePath={withFilePath}
            />
          )
        }
      }),
      [
        isItemDisabled,
        isSelectedItem,
        onItemNavigate,
        selectionModeActive,
        withFilePath
      ]
    )

    const tableContext = useMemo(
      () => ({
        data: items,
        isMobile,
        selectionModeActive,
        isItemDisabled,
        isSelectedItem,
        onItemClick,
        onItemToggle,
        onItemDoubleClick,
        onItemNavigate
      }),
      [
        isItemDisabled,
        isMobile,
        isSelectedItem,
        items,
        onItemClick,
        onItemDoubleClick,
        onItemNavigate,
        onItemToggle,
        selectionModeActive
      ]
    )

    return (
      <Box
        className="u-ph-1"
        height="100%"
        flex={1}
        minHeight={0}
        px={3}
        boxSizing="border-box"
      >
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

PickerViewTable.displayName = 'PickerViewTable'
PickerViewTable.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  itemsIdsSelected: PropTypes.arrayOf(PropTypes.string),
  onItemClick: PropTypes.func,
  onItemToggle: PropTypes.func,
  onItemDoubleClick: PropTypes.func,
  onItemNavigate: PropTypes.func,
  isItemDisabled: PropTypes.func.isRequired,
  fetchMore: PropTypes.func,
  scrollerRef: PropTypes.func,
  virtuosoRef: PropTypes.object,
  withFilePath: PropTypes.bool
}

export default PickerViewTable
