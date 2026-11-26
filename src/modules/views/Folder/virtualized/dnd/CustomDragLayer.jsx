import React from 'react'
import { useDragLayer } from 'react-dnd'

import styles from './CustomDragLayer.styl'
import DragPreviewWrapper from './DragPreviewWrapper'

// See https://react-dnd.github.io/react-dnd/examples/drag-around/custom-drag-layer
const CustomDragLayer = ({ dragId }) => {
  const { itemType, isDragging, item, initialOffset, currentOffset } =
    useDragLayer(monitor => ({
      item: monitor.getItem(),
      itemType: monitor.getItemType(),
      initialOffset: monitor.getInitialSourceClientOffset(),
      currentOffset: monitor.getSourceClientOffset(),
      isDragging: monitor.isDragging()
    }))

  if (!isDragging) {
    return null
  }

  return (
    <div className={styles.customDragLayer}>
      <DragPreviewWrapper
        item={item}
        itemType={itemType}
        dragId={dragId}
        initialOffset={initialOffset}
        currentOffset={currentOffset}
      />
    </div>
  )
}

export default CustomDragLayer
