import { renderHook, act } from '@testing-library/react'
import { RefObject } from 'react'

import { IOCozyFile } from 'cozy-client/types/types'

import * as helpers from './helpers'
import { useShiftSelection } from './index'

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: (): { isMobile: boolean } => ({ isMobile: false })
}))

jest.mock('@/modules/selection/SelectionProvider', () => ({
  useSelectionContext: jest.fn()
}))

jest.mock('./helpers', () => ({
  handleShiftClick: jest.fn().mockReturnValue({
    newSelectedItems: {},
    lastInteractedItemId: '1'
  }),
  handleShiftArrow: jest.fn().mockReturnValue({
    newSelectedItems: {},
    lastInteractedItemId: '1'
  }),
  FORWARD_DIRECTION: 1,
  BACKWARD_DIRECTION: -1
}))

import { useSelectionContext } from '@/modules/selection/SelectionProvider'
const mockUseSelectionContext = useSelectionContext as jest.Mock

// Get references to mocked functions
const mockHandleShiftArrow = helpers.handleShiftArrow as jest.Mock
const mockHandleShiftClick = helpers.handleShiftClick as jest.Mock

const createMockFile = (id: string): IOCozyFile =>
  ({
    _id: id,
    name: `file-${id}`,
    type: 'file'
  }) as IOCozyFile

const mockFiles = [
  createMockFile('1'),
  createMockFile('2'),
  createMockFile('3')
]

describe('useShiftSelection', () => {
  let mockSetSelectedItems: jest.Mock
  let mockIsItemSelected: jest.Mock
  let mockRef: RefObject<HTMLElement>
  let mockElement: HTMLElement
  let mockAddEventListener: jest.Mock
  let mockQuerySelector: jest.Mock
  let mockQuerySelectorAll: jest.Mock
  let mockGetBoundingClientRect: jest.Mock
  let mockScrollBy: jest.Mock

  beforeEach(() => {
    mockSetSelectedItems = jest.fn()
    mockIsItemSelected = jest.fn()
    mockAddEventListener = jest.fn()
    mockQuerySelector = jest.fn().mockReturnValue(null)
    mockQuerySelectorAll = jest.fn().mockReturnValue([])
    mockGetBoundingClientRect = jest.fn()
    mockScrollBy = jest.fn()

    mockElement = {
      focus: jest.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: jest.fn(),
      querySelector: mockQuerySelector,
      querySelectorAll: mockQuerySelectorAll,
      getBoundingClientRect: mockGetBoundingClientRect,
      scrollBy: mockScrollBy
    } as unknown as HTMLElement

    mockRef = { current: mockElement }

    mockUseSelectionContext.mockReturnValue({
      selectedItems: [],
      setSelectedItems: mockSetSelectedItems,
      isItemSelected: mockIsItemSelected,
      setIsSelectAll: jest.fn()
    })

    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should return correct interface', () => {
      const { result } = renderHook(() =>
        useShiftSelection({ items: mockFiles }, mockRef)
      )

      expect(result.current).toHaveProperty('setLastInteractedItem')
      expect(result.current).toHaveProperty('onShiftClick')
      expect(typeof result.current.onShiftClick).toBe('function')
      expect(typeof result.current.setLastInteractedItem).toBe('function')
    })
  })

  describe('keyboard event handling - list view', () => {
    it('should call handleShiftArrow on Shift+ArrowDown in list view', () => {
      renderHook(() =>
        useShiftSelection({ items: mockFiles, viewType: 'list' }, mockRef)
      )

      const keydownHandler = (
        (mockElement.addEventListener as jest.Mock).mock.calls[0] as unknown[]
      )[1] as (event: KeyboardEvent) => void
      const mockEvent = {
        shiftKey: true,
        key: 'ArrowDown',
        preventDefault: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        keydownHandler(mockEvent)
      })

      expect(mockHandleShiftArrow).toHaveBeenCalledWith({
        direction: 1,
        items: mockFiles,
        selectedItems: {},
        lastInteractedIdx: 0,
        isItemSelected: mockIsItemSelected
      })
    })

    it('should call handleShiftArrow on Shift+ArrowUp in list view', () => {
      renderHook(() =>
        useShiftSelection({ items: mockFiles, viewType: 'list' }, mockRef)
      )

      const keydownHandler = (
        (mockElement.addEventListener as jest.Mock).mock.calls[0] as unknown[]
      )[1] as (event: KeyboardEvent) => void
      const mockEvent = {
        shiftKey: true,
        key: 'ArrowUp',
        preventDefault: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        keydownHandler(mockEvent)
      })

      expect(mockHandleShiftArrow).toHaveBeenCalledWith(
        expect.objectContaining({ direction: -1 })
      )
    })
  })

  describe('keyboard event handling - grid view', () => {
    it('should call handleShiftArrow on Shift+ArrowRight in grid view', () => {
      renderHook(() =>
        useShiftSelection({ items: mockFiles, viewType: 'grid' }, mockRef)
      )

      const keydownHandler = (
        (mockElement.addEventListener as jest.Mock).mock.calls[0] as unknown[]
      )[1] as (event: KeyboardEvent) => void
      const mockEvent = {
        shiftKey: true,
        key: 'ArrowRight',
        preventDefault: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        keydownHandler(mockEvent)
      })

      expect(mockHandleShiftArrow).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 1 })
      )
    })

    it('should call handleShiftArrow on Shift+ArrowLeft in grid view', () => {
      renderHook(() =>
        useShiftSelection({ items: mockFiles, viewType: 'grid' }, mockRef)
      )

      const keydownHandler = (
        (mockElement.addEventListener as jest.Mock).mock.calls[0] as unknown[]
      )[1] as (event: KeyboardEvent) => void
      const mockEvent = {
        shiftKey: true,
        key: 'ArrowLeft',
        preventDefault: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        keydownHandler(mockEvent)
      })

      expect(mockHandleShiftArrow).toHaveBeenCalledWith(
        expect.objectContaining({ direction: -1 })
      )
    })
  })

  describe('onShiftClick', () => {
    it('should call handleShiftClick when shift key is pressed', () => {
      const { result } = renderHook(() =>
        useShiftSelection({ items: mockFiles }, mockRef)
      )

      const mockEvent = {
        shiftKey: true,
        stopPropagation: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        result.current.onShiftClick('2', mockEvent)
      })

      expect(mockHandleShiftClick).toHaveBeenCalledWith({
        startIdx: 0,
        endIdx: 1,
        selectedItems: {},
        items: mockFiles
      })
    })

    it('should not call handleShiftClick when shift key is not pressed', () => {
      const { result } = renderHook(() =>
        useShiftSelection({ items: mockFiles }, mockRef)
      )

      const mockEvent = {
        shiftKey: false,
        stopPropagation: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        result.current.onShiftClick('2', mockEvent)
      })

      expect(mockHandleShiftClick).not.toHaveBeenCalled()
    })
  })

  describe('auto-scroll current item into view', () => {
    const getKeydownHandler = (): ((event: KeyboardEvent) => void) => {
      const calls = mockAddEventListener.mock.calls[0] as unknown[]
      return calls[1] as (event: KeyboardEvent) => void
    }

    const makeFileElement = (fileId: string, rect: Partial<DOMRect>): Element =>
      ({
        getBoundingClientRect: jest.fn(() => rect)
      }) as unknown as Element

    it('scrolls down when the current item is below the scroll container', () => {
      mockGetBoundingClientRect.mockReturnValue({
        top: 0,
        bottom: 100
      })
      mockQuerySelector.mockReturnValue(
        makeFileElement('1', { top: 110, bottom: 140 })
      )

      renderHook(() =>
        useShiftSelection({ items: mockFiles, viewType: 'list' }, mockRef)
      )

      const mockEvent = {
        shiftKey: true,
        key: 'ArrowDown',
        preventDefault: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        getKeydownHandler()(mockEvent)
      })

      expect(mockScrollBy).toHaveBeenCalledWith({
        top: 40,
        behavior: 'auto'
      })
    })

    it('scrolls up when the current item is above the scroll container', () => {
      mockGetBoundingClientRect.mockReturnValue({
        top: 50,
        bottom: 150
      })
      mockQuerySelector.mockReturnValue(
        makeFileElement('1', { top: 20, bottom: 40 })
      )

      renderHook(() =>
        useShiftSelection({ items: mockFiles, viewType: 'list' }, mockRef)
      )

      const mockEvent = {
        shiftKey: true,
        key: 'ArrowUp',
        preventDefault: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        getKeydownHandler()(mockEvent)
      })

      expect(mockScrollBy).toHaveBeenCalledWith({
        top: -30,
        behavior: 'auto'
      })
    })

    it('does not scroll when the current item is already visible', () => {
      mockGetBoundingClientRect.mockReturnValue({
        top: 0,
        bottom: 100
      })
      mockQuerySelector.mockReturnValue(
        makeFileElement('1', { top: 20, bottom: 40 })
      )

      renderHook(() =>
        useShiftSelection({ items: mockFiles, viewType: 'list' }, mockRef)
      )

      const mockEvent = {
        shiftKey: true,
        key: 'ArrowDown',
        preventDefault: jest.fn()
      } as unknown as KeyboardEvent

      act(() => {
        getKeydownHandler()(mockEvent)
      })

      expect(mockScrollBy).not.toHaveBeenCalled()
    })
  })
})
