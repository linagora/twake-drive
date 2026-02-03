import React, { useRef, useCallback, useState, useMemo } from 'react'
import Selecto from 'react-selecto'

import styles from './RectangularSelection.styl'
import { useSelectionContext } from './SelectionProvider'

/**
 * Component that enables rectangular selection of files in a grid view.
 * Wraps children with a selection area that allows users to drag-select
 * multiple files by drawing a selection rectangle.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child elements to render inside the selection container
 * @param {Array<Object>} props.items - List of file items available for selection
 * @param {React.RefObject} props.scrollContainerRef - Ref to the scrollable container for auto-scroll during selection (fallback)
 * @param {HTMLElement|null} props.scrollElement - Direct HTMLElement for the scroll container (preferred over scrollContainerRef)
 * @param {HTMLElement|React.RefObject} props.dragContainer - Container element where drag selection can be initiated (defaults to containerRef.current)
 * @returns {React.ReactElement} The rectangular selection wrapper component
 */
const RectangularSelection = ({
  children,
  items,
  scrollContainerRef,
  scrollElement,
  dragContainer: dragContainerProp
}) => {
  // Use state instead of ref to trigger re-render when container is mounted
  const [containerElement, setContainerElement] = useState(null)
  const { setSelectedItems, selectedItems, setIsSelectAll } =
    useSelectionContext()
  const isDraggingRef = useRef(false)
  const dragStartPosRef = useRef(null)

  /**
   * Extracts file data from a DOM element using the data-file-id attribute.
   * Uses a Map for O(1) lookups instead of O(n) array.find().
   *
   * @param {Element} el - DOM element with data-file-id attribute
   * @returns {Object|undefined} The file object matching the element's ID, or undefined if not found
   */
  const itemsMap = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      map.set(item._id, item)
    }
    return map
  }, [items])

  const getFileFromElement = useCallback(
    el => {
      const fileId = el.getAttribute('data-file-id')
      if (!fileId) return undefined
      return itemsMap.get(fileId)
    },
    [itemsMap]
  )

  /**
   * Handles the selection event from react-selecto.
   * Updates the selected items state based on elements inside the selection rectangle.
   * Supports additive selection when Ctrl/Cmd key is held.
   * Optimized: tracks count directly instead of Object.keys().length
   *
   * @param {Object} e - Selecto event object
   * @param {Array<Element>} e.selected - Array of DOM elements inside the selection rectangle
   * @param {Object} e.inputEvent - The original input event with modifier key state
   */
  const handleSelect = useCallback(
    e => {
      const isMultiSelect = e.inputEvent?.ctrlKey || e.inputEvent?.metaKey
      const newSelection = isMultiSelect ? { ...selectedItems } : {}

      for (const el of e.selected) {
        const file = getFileFromElement(el)
        if (file && !newSelection[file._id]) {
          newSelection[file._id] = file
        }
      }

      setSelectedItems(newSelection)
      setIsSelectAll(Object.keys(newSelection).length === items.length)
    },
    [
      items.length,
      selectedItems,
      getFileFromElement,
      setSelectedItems,
      setIsSelectAll
    ]
  )

  /**
   * Determines whether a drag operation should initiate rectangular selection.
   * Prevents selection when clicking on interactive elements or directly on files.
   *
   * @param {Object} e - Selecto drag condition event
   * @param {Object} e.inputEvent - The original input event
   * @param {Element} e.inputEvent.target - The target element being clicked
   * @returns {boolean} True if drag selection should proceed, false otherwise
   */
  const dragCondition = useCallback(e => {
    const target = e.inputEvent?.target
    if (!target) return true

    const isInteractive = target.closest(
      'button,a,input,select,textarea,[role="button"]'
    )
    if (isInteractive) return false

    const fileElement = target.closest('[data-file-id]')
    return !fileElement
  }, [])

  /**
   * Records the starting position of a drag operation.
   * Used to distinguish between clicks and actual drag selections.
   *
   * @param {Object} e - Drag start event
   * @param {number} e.clientX - X coordinate of the drag start
   * @param {number} e.clientY - Y coordinate of the drag start
   */
  const handleDragStart = useCallback(e => {
    dragStartPosRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  /**
   * Handles the end of a drag operation.
   * Calculates drag distance to distinguish between clicks and rectangular selections.
   * Only considers it a real drag if the mouse moved more than 5 pixels.
   *
   * @param {Object} e - Drag end event
   * @param {number} e.clientX - X coordinate of the drag end
   * @param {number} e.clientY - Y coordinate of the drag end
   */
  const handleDragEnd = useCallback(e => {
    // Calculate the distance moved during the drag
    const startPos = dragStartPosRef.current
    if (startPos) {
      const dx = e.clientX - startPos.x
      const dy = e.clientY - startPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Only consider it a real drag if the mouse moved more than 5 pixels
      // This distinguishes between a click and a rectangular selection
      if (distance > 5) {
        isDraggingRef.current = true
        // Reset the flag after the click event has been processed
        setTimeout(() => {
          isDraggingRef.current = false
        }, 0)
      }
    }
    dragStartPosRef.current = null
  }, [])

  /**
   * Handles clicks on the container to clear selection when clicking empty space.
   * Skips if the click was part of a drag operation or if Ctrl/Cmd is pressed.
   * Prevents clearing when clicking on files or interactive elements.
   *
   * @param {React.MouseEvent} e - Click event
   */
  const handleContainerClick = useCallback(
    e => {
      // Skip if this click was part of a drag operation (rectangular selection)
      if (isDraggingRef.current) {
        e.stopPropagation()
        e.preventDefault()
        return
      }

      // Don't clear if Ctrl/Cmd is pressed (user wants to add to selection)
      if (e.ctrlKey || e.metaKey) return

      const target = e.target

      // Check if clicked on a file or interactive element
      const isOnFile = target.closest('[data-file-id]')
      if (isOnFile) return

      const isInteractive = target.closest(
        'button,a,input,select,textarea,[role="button"]'
      )
      if (isInteractive) return

      // If clicked in empty space, clear selection
      setSelectedItems({})
      setIsSelectAll(false)
    },
    [setSelectedItems, setIsSelectAll]
  )

  // Use the directly provided scrollElement (from virtuoso's scrollerRef),
  // or fall back to scrollContainerRef.current for non-virtualized containers
  const scrollContainer = scrollElement || scrollContainerRef?.current

  const dragContainer = useMemo(() => {
    if (dragContainerProp !== undefined) {
      const propValue = dragContainerProp?.current || dragContainerProp
      // If prop is provided but value is null, fallback to internal container
      return propValue || containerElement
    }
    return containerElement
  }, [dragContainerProp, containerElement])

  return (
    <div
      ref={setContainerElement}
      className="u-h-100 rectangular-selection-container"
      onClick={handleContainerClick}
    >
      {children}
      {containerElement && dragContainer && (
        <Selecto
          className={styles['cozy-selecto-box']}
          container={containerElement}
          dragContainer={dragContainer}
          selectableTargets={['[data-file-id]']}
          selectByClick={false}
          selectFromInside={false}
          hitRate={10}
          ratio={0}
          toggleContinueSelect="ctrl" // special key to extend the current selection
          continueSelect={false} // do not allow to extend the current selection without special key
          dragCondition={dragCondition}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onSelect={handleSelect}
          scrollOptions={
            scrollContainer
              ? {
                  container: scrollContainer,
                  throttleTime: 30,
                  threshold: 30
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

export default RectangularSelection
