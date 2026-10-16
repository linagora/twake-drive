import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { forwardRef } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import VirtualizedGridList from 'cozy-ui/transpiled/react/GridList/Virtualized'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'
import { usePickerItemHandlers } from './usePickerItemHandlers'

import filelistStyles from '@/styles/filelist.styl'
import gridStyles from '@/styles/folder-view.styl'

import { FileNameLabel } from '@/modules/filelist/cells/FileNameLabel'
import {
  getFileNameAndExtension,
  makeParentFolderPath
} from '@/modules/filelist/helpers'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'
import GridWrapper from '@/modules/views/Folder/virtualized/GridWrapper'

function handleGridItemKeyDown(event, item, isDisabled, onItemDoubleClick) {
  if (event.key === 'Enter' && onItemDoubleClick) {
    event.preventDefault()
    if (!isDisabled) onItemDoubleClick(item, event)
  }
}

function PickerViewGridItem({ item, context }) {
  const { t } = useI18n()
  const isDisabled = context.isItemDisabled(item)
  const disabledReason = context.getItemDisabledReason?.(item)
  const isSelected = context.itemsIdsSelected.includes(item._id)
  const { title, filename, extension } = getFileNameAndExtension(item, t)
  const handlers = usePickerItemHandlers({ ...context, item, isDisabled })

  return (
    <Tooltip title={disabledReason ? t(disabledReason) : title}>
      <Box
        component="button"
        type="button"
        data-testid="grid-item"
        data-file-id={item._id}
        aria-label={disabledReason ? `${title}. ${t(disabledReason)}` : title}
        aria-disabled={isDisabled}
        aria-pressed={isSelected}
        bgcolor={isSelected ? null : 'transparent'}
        className={cx(
          'u-flex u-flex-column u-flex-items-center u-w-100 u-bdw-0 u-bdrs-4',
          isDisabled ? 'u-c-default' : 'u-c-pointer',
          styles.pickerViewGridItem,
          filelistStyles['fil-content-column'],
          filelistStyles['fil-content-column-virtualized'],
          {
            [filelistStyles['fil-content-column-selected']]: isSelected,
            [filelistStyles['fil-content-column-disabled']]: isDisabled
          }
        )}
        {...handlers}
        onKeyDown={event =>
          handleGridItemKeyDown(
            event,
            item,
            isDisabled,
            context.onItemDoubleClick
          )
        }
      >
        <FileThumbnail file={item} size={96} />
        <div
          className={cx(
            'u-w-100',
            filelistStyles['fil-content-cell'],
            filelistStyles['fil-content-grid-view']
          )}
        >
          <div className={filelistStyles['fil-file']}>
            <FileNameLabel
              title={title}
              filename={filename}
              extension={extension}
            />
            {context.withFilePath && (
              <div className={filelistStyles['fil-file-path']}>
                {makeParentFolderPath(item)}
              </div>
            )}
          </div>
        </div>
      </Box>
    </Tooltip>
  )
}

PickerViewGridItem.propTypes = {
  item: PropTypes.object.isRequired,
  context: PropTypes.object.isRequired
}

const PickerViewGridList = forwardRef(function PickerViewGridList(
  { style, children },
  ref
) {
  return (
    <Box
      component={GridWrapper}
      ref={ref}
      style={style}
      justifyContent="flex-start"
      gridColumnGap={8}
    >
      {children}
    </Box>
  )
})

const gridComponents = { List: PickerViewGridList }

export function PickerViewGrid({
  items,
  itemsIdsSelected = [],
  isItemDisabled,
  getItemDisabledReason,
  onItemClick,
  onItemToggle,
  onItemDoubleClick,
  fetchMore,
  scrollerRef,
  virtuosoRef,
  withFilePath,
  beforeItems
}) {
  const { isMobile } = useBreakpoints()
  const context = {
    itemsIdsSelected,
    isItemDisabled,
    getItemDisabledReason,
    onItemClick,
    onItemToggle,
    onItemDoubleClick,
    withFilePath,
    isMobile,
    selectionModeActive: itemsIdsSelected.length > 0
  }

  return (
    <Box flex={1} minHeight={0} display="flex" flexDirection="column">
      {beforeItems}
      <Box
        flex={1}
        minHeight={0}
        className={gridStyles['fil-folder-body-grid-scroller']}
      >
        <VirtualizedGridList
          ref={virtuosoRef}
          scrollerRef={scrollerRef}
          items={items}
          components={gridComponents}
          context={context}
          endReached={fetchMore}
          computeItemKey={index => items[index]._id}
          itemContent={index => (
            <div className={filelistStyles['fil-content-grid-item']}>
              <PickerViewGridItem item={items[index]} context={context} />
            </div>
          )}
        />
      </Box>
    </Box>
  )
}

PickerViewGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  itemsIdsSelected: PropTypes.arrayOf(PropTypes.string),
  isItemDisabled: PropTypes.func.isRequired,
  getItemDisabledReason: PropTypes.func,
  onItemClick: PropTypes.func,
  onItemToggle: PropTypes.func,
  onItemDoubleClick: PropTypes.func,
  fetchMore: PropTypes.func,
  scrollerRef: PropTypes.func,
  virtuosoRef: PropTypes.object,
  withFilePath: PropTypes.bool,
  beforeItems: PropTypes.node
}
