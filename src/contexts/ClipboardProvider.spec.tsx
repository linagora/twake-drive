import '@testing-library/jest-dom'
import {
  render,
  screen,
  fireEvent,
  renderHook,
  act as actHook
} from '@testing-library/react'
import React from 'react'

import { IOCozyFile } from 'cozy-client/types/types'

import ClipboardProvider, { useClipboardContext } from './ClipboardProvider'

const mockFile1: IOCozyFile = {
  _id: 'file1',
  _rev: '1-abc',
  _type: 'io.cozy.files',
  name: 'test1.txt',
  type: 'file',
  dir_id: 'parent-folder',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
  size: 1024,
  md5sum: 'abc123',
  mime: 'text/plain',
  class: 'text',
  executable: false,
  attributes: { name: 'test1.txt' },
  metadata: {}
} as unknown as IOCozyFile

const mockFile2: IOCozyFile = {
  _id: 'file2',
  _rev: '1-def',
  _type: 'io.cozy.files',
  name: 'test2.txt',
  type: 'file',
  dir_id: 'parent-folder',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
  size: 2048,
  md5sum: 'def456',
  mime: 'text/plain',
  class: 'text',
  executable: false,
  attributes: { name: 'test2.txt' },
  metadata: {}
} as unknown as IOCozyFile

const mockFolder: IOCozyFile = {
  _id: 'folder1',
  _rev: '1-ghi',
  _type: 'io.cozy.files',
  name: 'Test Folder',
  type: 'directory',
  dir_id: 'parent-folder',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
  attributes: { name: 'Test Folder' },
  metadata: {}
} as unknown as IOCozyFile

const TestComponent = (): JSX.Element => {
  const {
    clipboardData,
    copyFiles,
    cutFiles,
    clearClipboard,
    hasClipboardData,
    isItemCut,
    showMoveValidationModal,
    hideMoveValidationModal,
    moveValidationModal
  } = useClipboardContext()

  return (
    <div>
      <div data-testid="clipboard-files-count">
        {clipboardData.files.length}
      </div>
      <div data-testid="clipboard-operation">
        {clipboardData.operation ?? 'none'}
      </div>
      <div data-testid="has-clipboard-data">{hasClipboardData.toString()}</div>
      <div data-testid="cut-item-ids">
        {Array.from(clipboardData.cutItemIds).join(',')}
      </div>
      <div data-testid="source-folder-id">
        {clipboardData.sourceFolderIds && clipboardData.sourceFolderIds.size > 0
          ? Array.from(clipboardData.sourceFolderIds).join(',')
          : 'none'}
      </div>
      <div data-testid="modal-visible">
        {moveValidationModal.isVisible.toString()}
      </div>
      <div data-testid="modal-type">{moveValidationModal.type ?? 'none'}</div>

      <button
        onClick={(): void =>
          copyFiles([mockFile1, mockFile2], new Set(['source-folder']))
        }
      >
        Copy Files
      </button>
      <button
        onClick={(): void => cutFiles([mockFile1], new Set(['source-folder']))}
      >
        Cut Files
      </button>
      <button onClick={clearClipboard}>Clear Clipboard</button>
      <button
        onClick={(): void =>
          showMoveValidationModal(
            'moveOutside',
            mockFile1,
            mockFolder,
            async (): Promise<void> => {
              // Empty async function for test
            },
            (): void => {
              // Empty function for test
            }
          )
        }
      >
        Show Modal
      </button>
      <button onClick={hideMoveValidationModal}>Hide Modal</button>
      <div data-testid="is-file1-cut">{isItemCut('file1').toString()}</div>
    </div>
  )
}

const renderWithProvider = (
  ui: React.ReactElement
): ReturnType<typeof render> => {
  return render(<ClipboardProvider>{ui}</ClipboardProvider>)
}

describe('ClipboardProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Copy Operations', () => {
    it('should copy files to clipboard', () => {
      renderWithProvider(<TestComponent />)

      fireEvent.click(screen.getByText('Copy Files'))
      // act(() => {
      //   screen.getByText('Copy Files').click()
      // })

      expect(screen.getByTestId('clipboard-files-count')).toHaveTextContent('2')
      expect(screen.getByTestId('clipboard-operation')).toHaveTextContent(
        'copy'
      )
      expect(screen.getByTestId('has-clipboard-data')).toHaveTextContent('true')
      expect(screen.getByTestId('source-folder-id')).toHaveTextContent(
        'source-folder'
      )
      expect(screen.getByTestId('cut-item-ids')).toHaveTextContent('')
    })

    it('should handle copy without source folder', () => {
      const { result } = renderHook(() => useClipboardContext(), {
        wrapper: ClipboardProvider
      })

      actHook(() => {
        result.current.copyFiles([mockFile1])
      })

      expect(result.current.clipboardData.sourceFolderIds).toBeNull()
    })
  })

  describe('Cut Operations', () => {
    it('should cut files to clipboard', () => {
      renderWithProvider(<TestComponent />)

      fireEvent.click(screen.getByText('Cut Files'))
      // act(() => {
      //   screen.getByText('Cut Files').click()
      // })

      expect(screen.getByTestId('clipboard-files-count')).toHaveTextContent('1')
      expect(screen.getByTestId('clipboard-operation')).toHaveTextContent('cut')
      expect(screen.getByTestId('has-clipboard-data')).toHaveTextContent('true')
      expect(screen.getByTestId('cut-item-ids')).toHaveTextContent('file1')
      expect(screen.getByTestId('is-file1-cut')).toHaveTextContent('true')
    })

    it('should track multiple cut item IDs', () => {
      const { result } = renderHook(() => useClipboardContext(), {
        wrapper: ClipboardProvider
      })

      actHook(() => {
        result.current.cutFiles([mockFile1, mockFile2])
      })

      expect(result.current.clipboardData.cutItemIds.has('file1')).toBe(true)
      expect(result.current.clipboardData.cutItemIds.has('file2')).toBe(true)
      expect(result.current.isItemCut('file1')).toBe(true)
      expect(result.current.isItemCut('file2')).toBe(true)
      expect(result.current.isItemCut('file3')).toBe(false)
    })
  })

  describe('Clear Operations', () => {
    it('should clear clipboard data', () => {
      renderWithProvider(<TestComponent />)

      // First copy some files
      fireEvent.click(screen.getByText('Copy Files'))
      // act(() => {
      //   screen.getByText('Copy Files').click()
      // })

      expect(screen.getByTestId('has-clipboard-data')).toHaveTextContent('true')

      // Then clear
      fireEvent.click(screen.getByText('Clear Clipboard'))
      // act(() => {
      //   screen.getByText('Clear Clipboard').click()
      // })

      expect(screen.getByTestId('clipboard-files-count')).toHaveTextContent('0')
      expect(screen.getByTestId('clipboard-operation')).toHaveTextContent(
        'none'
      )
      expect(screen.getByTestId('has-clipboard-data')).toHaveTextContent(
        'false'
      )
      expect(screen.getByTestId('cut-item-ids')).toHaveTextContent('')
      expect(screen.getByTestId('source-folder-id')).toHaveTextContent('none')
    })
  })

  describe('Move Validation Modal', () => {
    it('should show move validation modal', () => {
      renderWithProvider(<TestComponent />)

      fireEvent.click(screen.getByText('Show Modal'))
      // act(() => {
      //   screen.getByText('Show Modal').click()
      // })

      expect(screen.getByTestId('modal-visible')).toHaveTextContent('true')
      expect(screen.getByTestId('modal-type')).toHaveTextContent('moveOutside')
    })

    it('should hide move validation modal', () => {
      renderWithProvider(<TestComponent />)

      // First show modal
      fireEvent.click(screen.getByText('Show Modal'))
      // act(() => {
      //   screen.getByText('Show Modal').click()
      // })

      expect(screen.getByTestId('modal-visible')).toHaveTextContent('true')

      // Then hide modal
      fireEvent.click(screen.getByText('Hide Modal'))
      // act(() => {
      //   screen.getByText('Hide Modal').click()
      // })

      expect(screen.getByTestId('modal-visible')).toHaveTextContent('false')
      expect(screen.getByTestId('modal-type')).toHaveTextContent('none')
    })

    it('should handle all modal types', () => {
      const { result } = renderHook(() => useClipboardContext(), {
        wrapper: ClipboardProvider
      })

      const modalTypes = [
        'moveOutside',
        'moveInside',
        'moveSharedInside'
      ] as const

      modalTypes.forEach(type => {
        actHook(() => {
          result.current.showMoveValidationModal(
            type,
            mockFile1,
            mockFolder,
            async (): Promise<void> => {
              // Empty async function for test
            },
            (): void => {
              // Empty function for test
            }
          )
        })

        expect(result.current.moveValidationModal.type).toBe(type)
        expect(result.current.moveValidationModal.isVisible).toBe(true)
        expect(result.current.moveValidationModal.file).toEqual(mockFile1)
        expect(result.current.moveValidationModal.targetFolder).toEqual(
          mockFolder
        )
      })
    })
  })

  describe('State Transitions', () => {
    it('should replace clipboard data when copying new files', () => {
      const { result } = renderHook(() => useClipboardContext(), {
        wrapper: ClipboardProvider
      })

      // First copy
      actHook(() => {
        result.current.copyFiles([mockFile1])
      })

      expect(result.current.clipboardData.files).toHaveLength(1)
      expect(result.current.clipboardData.files[0]._id).toBe('file1')

      // Second copy should replace
      actHook(() => {
        result.current.copyFiles([mockFile2])
      })

      expect(result.current.clipboardData.files).toHaveLength(1)
      expect(result.current.clipboardData.files[0]._id).toBe('file2')
    })

    it('should transition from copy to cut operation', () => {
      const { result } = renderHook(() => useClipboardContext(), {
        wrapper: ClipboardProvider
      })

      // First copy
      actHook(() => {
        result.current.copyFiles([mockFile1])
      })

      expect(result.current.clipboardData.operation).toBe('copy')
      expect(result.current.clipboardData.cutItemIds.size).toBe(0)

      // Then cut
      actHook(() => {
        result.current.cutFiles([mockFile2])
      })

      expect(result.current.clipboardData.operation).toBe('cut')
      expect(result.current.clipboardData.cutItemIds.has('file2')).toBe(true)
      expect(result.current.clipboardData.cutItemIds.has('file1')).toBe(false)
    })
  })
})
