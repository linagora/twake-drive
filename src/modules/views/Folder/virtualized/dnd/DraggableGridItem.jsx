import cx from 'classnames'
import React from 'react'

import { useDragAndDrop } from './useDragAndDrop'

const DraggableGridItem = ({ item, context, className }) => {
  const { isOver, isInDropProcess, dragAndDropRef } = useDragAndDrop({
    item,
    context
  })

  return (
    <div
      ref={dragAndDropRef}
      className={cx(className, 'virtualized', { 'u-o-50': isInDropProcess })}
    >
      {context.itemRenderer(item, { isOver })}
    </div>
  )
}

export default DraggableGridItem
