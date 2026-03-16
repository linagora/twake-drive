import { useRef, useState } from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { makeDesktopHandlers, makeMobileHandlers } from './helpers'

import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

export const useLongPress = ({
  file,
  disabled,
  isRenaming,
  openLink,
  toggle,
  onInteractWithFile
}) => {
  const timerId = useRef()
  const isLongPress = useRef(false)
  const [lastClickTime, setLastClickTime] = useState(0)
  const { isDesktop } = useBreakpoints()
  const {
    setSelectedItems,
    clearSelection,
    isSelectionBarVisible: selectionModeActive
  } = useSelectionContext()
  const { clearItems: clearHighlightedItems } = useNewItemHighlightContext()

  if (isDesktop) {
    // eslint-disable-next-line react-hooks/refs
    return makeDesktopHandlers({
      file,
      timerId,
      disabled,
      isRenaming,
      openLink,
      toggle,
      selectionModeActive,
      lastClickTime,
      setLastClickTime,
      clearSelection,
      setSelectedItems,
      onInteractWithFile,
      clearHighlightedItems
    })
  }

  // eslint-disable-next-line react-hooks/refs
  return makeMobileHandlers({
    timerId,
    disabled,
    selectionModeActive,
    isRenaming,
    isLongPress,
    openLink,
    toggle,
    clearHighlightedItems
  })
}
