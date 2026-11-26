import React, { useEffect, useState } from 'react'

import DragPreview from './DragPreview'

const DragPreviewWrapper = ({
  item,
  itemType,
  dragId,
  initialOffset,
  currentOffset
}) => {
  const [mousePosition, setMousePosition] = useState({ x: null, y: null })

  useEffect(() => {
    const handleDragOver = e => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('dragover', handleDragOver)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
    }
  }, [])

  const isPreviewShown =
    itemType === dragId &&
    initialOffset !== null &&
    currentOffset !== null &&
    mousePosition.x !== null &&
    mousePosition.y !== null

  if (!isPreviewShown) {
    return null
  }

  return (
    <div
      style={{
        transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`
      }}
    >
      <DragPreview
        fileName={item.draggedItems[0].name}
        selectedCount={item.draggedItems.length}
      />
    </div>
  )
}

export default DragPreviewWrapper
