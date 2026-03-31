import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import Selecto from 'react-selecto'

import styles from './RectangularSelection.styl'
import { useSelectionContext } from './SelectionProvider'

const INTERACTIVE_ELEMENTS_SELECTOR =
  'button,a,input,select,textarea,label,[role="button"],[role="menuitem"],[role="option"]'
const SCROLL_STEP_IN_PIXELS = 10
/**
 * Hit rate for the Selecto library.
 * Controls how frequently the selection rectangle checks for elements to select.
 * A value of 1 means it checks every pixel, ensuring precise selection.
 */
const HIT_RATE = 1

const buildSelectionFromItems = (fileIds, itemsMap) => {
  const newSelection = {}
  let lastSelectedId = null
  for (const fileId of fileIds) {
    const file = itemsMap.get(fileId)
    if (file) {
      newSelection[fileId] = file
      lastSelectedId = fileId
    }
  }
  return { newSelection, lastSelectedId }
}

const getVisibleFileIdsFromSelecto = selectoRef => {
  const selectableElements = selectoRef.current?.getSelectableElements() || []
  const visibleFileIds = new Set()
  for (const el of selectableElements) {
    const fileId = el.getAttribute('data-file-id')
    if (fileId) {
      visibleFileIds.add(fileId)
    }
  }
  return visibleFileIds
}

const getSelectedFileIdsFromSelectoEvent = (e, getFileFromElement) => {
  const selectedFileIds = new Set()
  for (const el of e.selected) {
    const file = getFileFromElement(el)
    if (file) {
      selectedFileIds.add(file._id)
    }
  }
  return selectedFileIds
}

const accumulateSelectedItemsDuringDrag = (
  selectedDuringDragRef,
  selectedFileIds,
  visibleFileIds,
  preserveAll
) => {
  const newAccumulated = new Set()
  for (const fileId of selectedDuringDragRef.current) {
    if (
      preserveAll ||
      !visibleFileIds.has(fileId) ||
      selectedFileIds.has(fileId)
    ) {
      newAccumulated.add(fileId)
    }
  }
  for (const fileId of selectedFileIds) {
    newAccumulated.add(fileId)
  }
  return newAccumulated
}

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
 * @returns {React.ReactElement} The rectangular selection wrapper component
 */
const RectangularSelection = ({
  children,
  items,
  scrollContainerRef,
  scrollElement,
  onSelectEnd
}) => {
  const containerRef = useRef(null)
  const selectoRef = useRef(null)
  const [isContainerReady, setIsContainerReady] = useState(false)
  const { setSelectedItems, selectedItems, setIsSelectAll } =
    useSelectionContext()
  const [resolvedScrollContainer, setResolvedScrollContainer] = useState(null)
  const isDraggingRef = useRef(false)
  const dragStartPosRef = useRef(null)
  const wheelScrolledDuringDragRef = useRef(false)
  const mutationObserverRef = useRef(null)
  const selectedDuringDragRef = useRef(new Set())

  useEffect(() => {
    if (containerRef.current) {
      setIsContainerReady(true)
    }

    return () => {
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect()
      }
    }
  }, [])

  useEffect(() => {
    setResolvedScrollContainer(
      scrollElement || scrollContainerRef?.current || null
    )
  }, [scrollElement, scrollContainerRef, isContainerReady])

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
      const visibleFileIds = getVisibleFileIdsFromSelecto(selectoRef)
      const selectedFileIds = getSelectedFileIdsFromSelectoEvent(
        e,
        getFileFromElement
      )
      // After a wheel scroll, items may still be in the DOM but outside
      // the selection rectangle (content shifted, not rectangle shrunk).
      // In that case, preserve all accumulated items to avoid losing them.
      const newAccumulated = accumulateSelectedItemsDuringDrag(
        selectedDuringDragRef,
        selectedFileIds,
        visibleFileIds,
        wheelScrolledDuringDragRef.current
      )
      selectedDuringDragRef.current = newAccumulated

      const { newSelection, lastSelectedId } = buildSelectionFromItems(
        newAccumulated,
        itemsMap
      )

      setSelectedItems(newSelection)
      setIsSelectAll(Object.keys(newSelection).length === items.length)

      if (lastSelectedId) {
        onSelectEnd?.(lastSelectedId)
      }
    },
    [
      items.length,
      itemsMap,
      getFileFromElement,
      setSelectedItems,
      setIsSelectAll,
      onSelectEnd
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

    const isInteractive = target.closest(INTERACTIVE_ELEMENTS_SELECTOR)
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
  const handleDragStart = useCallback(
    e => {
      dragStartPosRef.current = { x: e.clientX, y: e.clientY }
      isDraggingRef.current = false
      selectedDuringDragRef.current.clear()

      // If Ctrl/Cmd is pressed, start with current selection
      if (e.inputEvent?.ctrlKey || e.inputEvent?.metaKey) {
        for (const item of Object.values(selectedItems)) {
          selectedDuringDragRef.current.add(item._id)
        }
      }
    },
    [selectedItems]
  )

  /**
   * Handles drag movement during the selection.
   * Calculates distance from drag start and marks it as a real drag if moved more than 5 pixels.
   *
   * @param {Object} e - Drag event
   * @param {number} e.clientX - X coordinate of the drag
   * @param {number} e.clientY - Y coordinate of the drag
   */
  const handleDrag = useCallback(e => {
    const start = dragStartPosRef.current
    if (!start) return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y

    if (Math.hypot(dx, dy) > 5) {
      isDraggingRef.current = true
    }
  }, [])

  /**
   * Handles the end of a drag operation.
   * Cleans up the drag start position reference.
   */
  const handleDragEnd = useCallback(() => {
    dragStartPosRef.current = null
    wheelScrolledDuringDragRef.current = false
    selectedDuringDragRef.current.clear()
  }, [])

  /**
   * Sets up a MutationObserver on the scroll container to detect when
   * virtuoso adds or removes DOM elements (e.g. after scrolling).
   * When mutations are detected during a drag, we force selecto to
   * re-discover selectable targets so newly rendered elements can be selected.
   */
  useEffect(() => {
    if (!resolvedScrollContainer) return

    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect()
    }

    const observer = new MutationObserver(() => {
      if (isDraggingRef.current && selectoRef.current) {
        selectoRef.current.findSelectableTargets()
      }
    })

    observer.observe(resolvedScrollContainer, {
      childList: true,
      subtree: true
    })
    mutationObserverRef.current = observer

    return () => observer.disconnect()
  }, [resolvedScrollContainer])

  /**
   * Listens for mouse wheel scroll during a drag selection.
   * Marks that a wheel scroll occurred so the accumulator preserves
   * all previously selected items instead of dropping those that
   * are still in the DOM but scrolled out of the selection rectangle.
   */
  useEffect(() => {
    if (!resolvedScrollContainer) return

    const handleWheel = () => {
      if (!isDraggingRef.current) return
      wheelScrolledDuringDragRef.current = true
    }

    resolvedScrollContainer.addEventListener('wheel', handleWheel, {
      passive: true
    })

    return () =>
      resolvedScrollContainer.removeEventListener('wheel', handleWheel)
  }, [resolvedScrollContainer])

  /**
   * Handles scroll events from react-selecto during drag selection.
   * When the selection rectangle reaches the edge of the scrollable container,
   * Selecto fires this event and we must manually scroll the container.
   *
   * New elements rendered by virtuoso after scrolling are detected by the
   * MutationObserver which triggers selecto to re-check selectable targets.
   *
   * @param {Object} e - Selecto scroll event
   * @param {number[]} e.direction - Scroll direction [x, y], each -1, 0, or 1
   */
  const handleScroll = useCallback(
    e => {
      if (!resolvedScrollContainer) return

      resolvedScrollContainer.scrollBy(
        e.direction[0] * SCROLL_STEP_IN_PIXELS,
        e.direction[1] * SCROLL_STEP_IN_PIXELS
      )
    },
    [resolvedScrollContainer]
  )

  /**
   * Handles clicks on the container to clear selection when clicking empty space.
   * Skips if the click was part of a drag operation or if Ctrl/Cmd is pressed.
   * Prevents clearing when clicking on files or interactive elements.
   *
   * @param {React.MouseEvent} e - Click event
   */
  const handleContainerClick = useCallback(
    e => {
      // Early return if this click was part of a drag operation (rectangular selection)
      if (isDraggingRef.current) {
        e.stopPropagation()
        e.preventDefault()
        return
      }

      // Early return if Ctrl/Cmd is pressed (user wants to add to selection)
      if (e.ctrlKey || e.metaKey) return

      const target = e.target

      // Early return if clicked on a file
      if (target.closest('[data-file-id]')) return

      // Early return if clicked on interactive element
      if (target.closest(INTERACTIVE_ELEMENTS_SELECTOR)) return

      // If clicked in empty space, clear selection
      setSelectedItems({})
      setIsSelectAll(false)
    },
    [setSelectedItems, setIsSelectAll]
  )

  return (
    <div
      ref={containerRef}
      className="u-h-100 rectangular-selection-container"
      onClick={handleContainerClick}
    >
      {children}
      {isContainerReady && (
        <Selecto
          ref={selectoRef}
          className={styles['cozy-selecto-box']}
          // eslint-disable-next-line react-hooks/refs
          container={containerRef.current}
          dragContainer={window}
          selectableTargets={['[data-file-id]']}
          selectByClick={false}
          selectFromInside={false}
          hitRate={HIT_RATE}
          ratio={0}
          toggleContinueSelect="ctrl" // special key to extend the current selection
          continueSelect={false} // do not allow to extend the current selection without special key
          dragCondition={dragCondition}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onSelect={handleSelect}
          onScroll={handleScroll}
          scrollOptions={
            resolvedScrollContainer
              ? {
                  container: resolvedScrollContainer,
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
