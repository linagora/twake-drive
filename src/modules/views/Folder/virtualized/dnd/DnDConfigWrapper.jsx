import { forwardRef, useEffect, useState } from 'react'
import { useDragDropManager } from 'react-dnd'

const SCROLL_THRESHOLD = 100
const SCROLL_MAX_SPEED = 75
const SCROLL_INTERVAL_MS = 16

const DnDConfigWrapper = forwardRef(({ children }, ref) => {
  const dragDropManager = useDragDropManager()
  const monitor = dragDropManager.getMonitor()
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const unsubscribe = monitor.subscribeToStateChange(() => {
      setIsDragging(monitor.isDragging())
    })
    return () => unsubscribe()
  }, [monitor])

  useEffect(() => {
    if (!isDragging) return

    const intervalId = setInterval(() => {
      const offset = monitor.getClientOffset()
      const container = ref.current
      if (!offset || !container) return

      const { top, bottom } = container.getBoundingClientRect()
      const distanceToTop = offset.y - top
      const distanceToBottom = bottom - offset.y

      if (distanceToTop < SCROLL_THRESHOLD) {
        const speed = SCROLL_MAX_SPEED * (1 - distanceToTop / SCROLL_THRESHOLD)
        container.scrollBy(0, -speed)
      } else if (distanceToBottom < SCROLL_THRESHOLD) {
        const speed =
          SCROLL_MAX_SPEED * (1 - distanceToBottom / SCROLL_THRESHOLD)
        container.scrollBy(0, speed)
      }
    }, SCROLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [isDragging, monitor, ref])

  return children
})

DnDConfigWrapper.displayName = 'DnDConfigWrapper'

export default DnDConfigWrapper
