import cx from 'classnames'
import React from 'react'

import TableRowClassic from 'cozy-ui/transpiled/react/TableRow'

import { useDragAndDrop } from './useDragAndDrop'

const DraggableTableRow = ({ item, context, isDisabled, ...props }) => {
  const { isDragging, isOver, isInDropProcess, dragAndDropRef } =
    useDragAndDrop({ item, context })
  const isSelected = context.isSelectedItem(item)
  const isNew = context.isNewItem(item)

  return (
    <TableRowClassic
      {...props}
      ref={dragAndDropRef}
      selected={isSelected || isOver}
      className={cx(isDragging ? 'virtualized u-o-50' : 'virtualized', {
        new: isNew
      })}
      disabled={isInDropProcess || isDisabled}
      hover
    />
  )
}

export default DraggableTableRow
