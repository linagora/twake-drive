import { useCallback, useRef } from 'react'

import { models } from 'cozy-client'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useFilePickerSelection } from './useFilePickerSelection'

const {
  file: { isDirectory }
} = models

export const useFilePickerAdapter = ({
  items = [],
  canSelectItem,
  multiple = false,
  selectionContainerRef: externalSelectionContainerRef,
  scrollElement,
  scrollToIndex,
  navigateTo,
  onFileDoubleClick
}) => {
  const { isMobile } = useBreakpoints()
  const internalSelectionContainerRef = useRef(null)
  const selectionContainerRef =
    externalSelectionContainerRef || internalSelectionContainerRef

  const { handleItemClick, handleMobileToggleSelect, selectedItemIds } =
    useFilePickerSelection({
      items,
      canSelectItem,
      multiple,
      selectionContainerRef,
      scrollElement,
      scrollToIndex
    })

  const handleListItemDoubleClick = useCallback(
    item => {
      if (isDirectory(item)) {
        navigateTo?.(item)
      } else if (onFileDoubleClick) {
        onFileDoubleClick(item)
      }
    },
    [navigateTo, onFileDoubleClick]
  )

  const handleMobileItemClick = useCallback(
    (item, event) => {
      if (isDirectory(item)) {
        navigateTo?.(item)
      } else {
        handleMobileToggleSelect(item, event)
      }
    },
    [handleMobileToggleSelect, navigateTo]
  )

  return {
    selectedItemIds,
    handleItemClick,
    handleMobileToggleSelect,
    onItemClick: isMobile ? handleMobileItemClick : handleItemClick,
    onItemToggle: isMobile ? handleMobileToggleSelect : null,
    onItemDoubleClick: isMobile ? null : handleListItemDoubleClick
  }
}

export default useFilePickerAdapter
