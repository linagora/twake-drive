import { act, renderHook } from '@testing-library/react'
import React from 'react'

import { useFilePickerAdapter } from './useFilePickerAdapter'

import { SelectionProvider } from '@/modules/selection/SelectionProvider'

const mockUseBreakpoints = jest.fn()
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: (...args) => mockUseBreakpoints(...args),
  useBreakpoints: (...args) => mockUseBreakpoints(...args)
}))

jest.mock('cozy-client', () => ({
  models: {
    file: {
      isDirectory: item => item.type === 'directory'
    }
  }
}))

const mockItems = [
  { _id: 'folder-1', name: 'Folder 1', type: 'directory' },
  { _id: 'file-1', name: 'File 1', type: 'file' }
]

const wrapper = ({ children }) => (
  <SelectionProvider clearOnLocationChange={false}>
    {children}
  </SelectionProvider>
)

describe('useFilePickerAdapter', () => {
  let selectionContainer
  let selectionContainerRef

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseBreakpoints.mockReturnValue({ isMobile: false })
    selectionContainer = document.createElement('div')
    selectionContainer.tabIndex = -1
    document.body.appendChild(selectionContainer)
    selectionContainerRef = { current: selectionContainer }
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('routes desktop double click to navigateTo for directories and onFileDoubleClick for files', () => {
    const navigateTo = jest.fn()
    const onFileDoubleClick = jest.fn()

    const { result } = renderHook(
      () =>
        useFilePickerAdapter({
          items: mockItems,
          canSelectItem: () => true,
          multiple: true,
          selectionContainerRef,
          navigateTo,
          onFileDoubleClick
        }),
      { wrapper }
    )

    act(() => {
      result.current.onItemDoubleClick(mockItems[0])
    })
    expect(navigateTo).toHaveBeenCalledWith(mockItems[0])
    expect(onFileDoubleClick).not.toHaveBeenCalled()

    act(() => {
      result.current.onItemDoubleClick(mockItems[1])
    })
    expect(onFileDoubleClick).toHaveBeenCalledWith(mockItems[1])
  })

  it('routes mobile tap to navigateTo for directories and toggle select for files', () => {
    mockUseBreakpoints.mockReturnValue({ isMobile: true })
    const navigateTo = jest.fn()

    const { result } = renderHook(
      () =>
        useFilePickerAdapter({
          items: mockItems,
          canSelectItem: () => true,
          multiple: true,
          selectionContainerRef,
          navigateTo
        }),
      { wrapper }
    )

    act(() => {
      result.current.onItemClick(mockItems[0], {})
    })
    expect(navigateTo).toHaveBeenCalledWith(mockItems[0])

    act(() => {
      result.current.onItemClick(mockItems[1], {})
    })
    expect(result.current.selectedItemIds).toContain('file-1')
  })
})
