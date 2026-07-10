import { act, fireEvent, renderHook } from '@testing-library/react'
import React from 'react'

import { useFilePickerSelection } from './useFilePickerSelection'

import {
  useSelectionContext,
  SelectionProvider
} from '@/modules/selection/SelectionProvider'

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: () => ({ isMobile: false })
}))

const items = [
  { _id: 'file-1', type: 'file', name: 'File 1' },
  { _id: 'file-2', type: 'file', name: 'File 2' },
  { _id: 'file-3', type: 'file', name: 'File 3' },
  { _id: 'file-4', type: 'file', name: 'File 4' }
]

const canSelectItem = item => item.type === 'file'

const makeClickEvent = eventProps => ({
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  ...eventProps
})

const makeWrapper = () => {
  const Wrapper = ({ children }) => (
    <SelectionProvider clearOnLocationChange={false}>
      {children}
    </SelectionProvider>
  )

  return Wrapper
}

const setup = ({ multiple = true, setupItems = items, scrollToIndex } = {}) => {
  const selectionContainer = document.createElement('div')
  selectionContainer.tabIndex = -1
  document.body.appendChild(selectionContainer)
  const selectionContainerRef = { current: selectionContainer }
  const hook = renderHook(
    () => {
      const pickerSelection = useFilePickerSelection({
        items: setupItems,
        canSelectItem,
        multiple,
        selectionContainerRef,
        scrollToIndex
      })
      const { selectedItems } = useSelectionContext()

      return {
        ...pickerSelection,
        selectedItemIds: selectedItems.map(item => item._id)
      }
    },
    { wrapper: makeWrapper() }
  )

  return { ...hook, selectionContainer }
}

describe('useFilePickerSelection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  it('should toggle selection with Ctrl+click', () => {
    const { result } = setup()

    act(() => {
      result.current.handleItemClick(items[0], makeClickEvent())
    })

    const event = makeClickEvent({ ctrlKey: true })
    act(() => {
      result.current.handleItemClick(items[1], event)
    })

    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(result.current.selectedItemIds).toEqual(['file-1', 'file-2'])
  })

  it('should select a range with Shift+click', () => {
    const { result } = setup()

    act(() => {
      result.current.handleItemClick(items[0], makeClickEvent())
    })

    const event = makeClickEvent({ shiftKey: true })
    act(() => {
      result.current.handleItemClick(items[2], event)
    })

    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(result.current.selectedItemIds).toEqual([
      'file-1',
      'file-2',
      'file-3'
    ])
  })

  it('should select all items with Ctrl+A', () => {
    const { result } = setup()

    act(() => {
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true })
    })

    expect(result.current.selectedItemIds).toEqual([
      'file-1',
      'file-2',
      'file-3',
      'file-4'
    ])
  })

  it('should focus the selection container after clicking an item', () => {
    const { result, selectionContainer } = setup()
    const otherButton = document.createElement('button')
    document.body.appendChild(otherButton)
    otherButton.focus()

    act(() => {
      result.current.handleItemClick(items[0], makeClickEvent())
    })

    expect(document.activeElement).toBe(selectionContainer)
  })

  it('should extend selection with Shift+ArrowDown', () => {
    const { result, selectionContainer } = setup()

    act(() => {
      fireEvent.keyDown(selectionContainer, {
        key: 'ArrowDown',
        shiftKey: true
      })
    })
    expect(result.current.selectedItemIds).toEqual(['file-1'])

    act(() => {
      fireEvent.keyDown(selectionContainer, {
        key: 'ArrowDown',
        shiftKey: true
      })
    })

    expect(result.current.selectedItemIds).toEqual(['file-1', 'file-2'])
  })

  it('should scroll to the original index when unselectable items are filtered out', () => {
    const pickerItems = [
      items[0],
      { _id: 'folder-1', type: 'folder', name: 'Folder 1' },
      items[1]
    ]
    const scrollToIndex = jest.fn()
    const { selectionContainer } = setup({
      setupItems: pickerItems,
      scrollToIndex
    })

    act(() => {
      fireEvent.keyDown(selectionContainer, {
        key: 'ArrowDown',
        shiftKey: true
      })
    })

    act(() => {
      fireEvent.keyDown(selectionContainer, {
        key: 'ArrowDown',
        shiftKey: true
      })
    })

    expect(scrollToIndex).toHaveBeenLastCalledWith(2, 'end')
  })

  it('should extend selection with Shift+ArrowDown even when focus moved outside the selection container', () => {
    const { result } = setup()
    const otherButton = document.createElement('button')
    document.body.appendChild(otherButton)

    act(() => {
      result.current.handleItemClick(items[0], makeClickEvent())
    })
    otherButton.focus()

    act(() => {
      fireEvent.keyDown(otherButton, {
        key: 'ArrowDown',
        shiftKey: true
      })
    })

    expect(result.current.selectedItemIds).toEqual(['file-1', 'file-2'])
  })
})
