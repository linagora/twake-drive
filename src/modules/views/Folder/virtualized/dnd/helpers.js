export const getDraggedItems = ({ item, selectedItems }) =>
  selectedItems.length > 0 ? selectedItems : [item]

export const isItemDraggable = ({ isSelected, selectedItems }) =>
  selectedItems.length === 0 || isSelected

export const isItemDragged = ({ item, draggedItems }) =>
  draggedItems.some(draggedItem => draggedItem._id === item._id)
