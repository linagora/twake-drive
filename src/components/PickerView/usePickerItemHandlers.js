import { useEffect, useRef } from 'react'

import { makeMobileHandlers } from '@/hooks/useOnLongPress/helpers'

export function usePickerItemHandlers({
  item,
  isDisabled,
  isMobile,
  selectionModeActive,
  onItemClick,
  onItemToggle,
  onItemDoubleClick
}) {
  const timerId = useRef(null)
  const isLongPress = useRef(false)

  useEffect(() => () => clearTimeout(timerId.current), [])

  const handleClick = event => {
    if (!isDisabled) onItemClick?.(item, event)
  }
  const handleToggle = event => {
    if (!isDisabled) onItemToggle?.(item, event)
  }
  const handleDoubleClick = event => {
    if (!isDisabled) onItemDoubleClick?.(item, event)
  }

  if (isMobile) {
    // eslint-disable-next-line react-hooks/refs
    return makeMobileHandlers({
      timerId,
      disabled: isDisabled,
      selectionModeActive,
      isRenaming: false,
      isLongPress,
      openLink: handleClick,
      toggle: handleToggle
    })
  }

  return { onClick: handleClick, onDoubleClick: handleDoubleClick }
}
