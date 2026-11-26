import { useEffect } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'

import { getDraggedItems, isItemDraggable, isItemDragged } from './helpers'

/**
 * Makes a file of a virtualized list draggable, and a drop target for the
 * dragged files. While a selection exists, only selected files can be
 * dragged, and they are all dragged together.
 *
 * @param {object} params
 * @param {object} params.item - The file
 * @param {object} params.context - The virtuoso context of the list
 * @returns {{ isDragging: boolean, isOver: boolean, isInDropProcess: boolean, dragAndDropRef: Function }}
 */
export const useDragAndDrop = ({ item, context }) => {
  const {
    selectedItems,
    isSelectedItem,
    itemsInDropProcess,
    setItemsInDropProcess,
    dragProps
  } = context
  const { onDrop, dragId } = dragProps
  const isSelected = isSelectedItem(item)
  const draggedItems = getDraggedItems({ item, selectedItems })

  const [{ isDragging }, dragRef, dragPreviewRef] = useDrag(
    () => ({
      type: dragId,
      isDragging: monitor =>
        isItemDragged({ item, draggedItems: monitor.getItem().draggedItems }),
      item: { draggedItems },
      canDrag: () => isItemDraggable({ isSelected, selectedItems }),
      collect: monitor => ({
        isDragging: monitor.isDragging()
      })
    }),
    [dragId, item, selectedItems]
  )

  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: dragId,
      drop: async draggedItem => {
        setItemsInDropProcess(
          draggedItem.draggedItems.map(draggedFile => draggedFile._id)
        )
        await onDrop(draggedItem.draggedItems, item, selectedItems)
        setItemsInDropProcess([])
      },
      collect: monitor => ({
        isOver: monitor.isOver()
      })
    }),
    [dragId, item, selectedItems, onDrop]
  )

  // Hides the native preview so that CustomDragLayer draws its own
  useEffect(() => {
    dragPreviewRef(getEmptyImage(), { captureDraggingState: true })
  }, [dragPreviewRef])

  const dragAndDropRef = node => dragRef(dropRef(node))

  return {
    isDragging,
    isOver,
    isInDropProcess: itemsInDropProcess.includes(item._id),
    dragAndDropRef
  }
}
