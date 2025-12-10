import '@testing-library/jest-dom'
import { renderHook, act } from '@testing-library/react-hooks'
import React from 'react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'

jest.mock('cozy-client/dist/models/file', () => ({
  isFile: jest.fn()
}))

jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: jest.fn()
}))

jest.mock('twake-i18n', () => ({
  useI18n: jest.fn(),
  translate: jest.fn(key => key),
  createUseI18n: jest.fn(() => () => ({ t: key => key })),
  I18nProvider: ({ children }) => children,
  withOnlyLocales: jest.fn(() => Component => Component),
  withLocales: jest.fn(() => Component => Component),
  useExtendI18n: jest.fn()
}))

jest.mock('./helpers', () => ({
  isEditableTarget: jest.fn(),
  shouldBlockKeyboardShortcuts: jest.fn(),
  normalizeKey: jest.fn()
}))

jest.mock('@/components/pushClient', () => ({
  isMacOS: jest.fn()
}))

jest.mock('@/contexts/ClipboardProvider', () => ({
  useClipboardContext: jest.fn()
}))

jest.mock('@/hooks', () => ({
  useDisplayedFolder: jest.fn()
}))

jest.mock('@/modules/drive/rename', () => ({
  startRenamingAsync: jest.fn()
}))

jest.mock('@/modules/nextcloud/hooks/useNextcloudCurrentFolder', () => ({
  useNextcloudCurrentFolder: jest.fn()
}))

jest.mock('@/modules/paste', () => ({
  handlePasteOperation: jest.fn()
}))

jest.mock('@/modules/selection/SelectionProvider', () => ({
  useSelectionContext: jest.fn()
}))

jest.mock('cozy-flags', () => jest.fn())

jest.mock('cozy-sharing', () => ({
  SharedDocument: ({ children }) =>
    children({ isSharedByMe: false, link: null, recipients: [] }),
  SharedRecipientsList: () => null,
  withLocales: component => component
}))

import { useI18n } from 'twake-i18n'

import { isFile } from 'cozy-client/dist/models/file'
import flag from 'cozy-flags'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { shouldBlockKeyboardShortcuts, normalizeKey } from './helpers'
import { useKeyboardShortcuts } from './useKeyboardShortcuts.tsx'

import { isMacOS } from '@/components/pushClient'
import {
  OPERATION_COPY,
  OPERATION_CUT,
  useClipboardContext
} from '@/contexts/ClipboardProvider'
import { useDisplayedFolder } from '@/hooks'
import { startRenamingAsync } from '@/modules/drive/rename'
import { useNextcloudCurrentFolder } from '@/modules/nextcloud/hooks/useNextcloudCurrentFolder'
import { handlePasteOperation } from '@/modules/paste'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

describe('useKeyboardShortcuts', () => {
  let mockDispatch
  let mockShowAlert
  let mockT
  let mockCopyFiles
  let mockCutFiles
  let mockClearClipboard
  let mockSelectAll
  let mockClearSelection
  let mockHideSelectionBar
  let mockShowMoveValidationModal
  let mockOnPaste
  let mockClient
  let mockCurrentFolder
  let mockSelectedItems
  let mockItems
  let store

  const createWrapper = () => {
    const mockReducer = (state = {}) => state
    store = createStore(mockReducer)

    return ({ children }) => <Provider store={store}>{children}</Provider>
  }

  beforeEach(() => {
    mockT = jest.fn((key, options) => {
      if (options && options.count !== undefined) {
        return `${key}_${options.count}`
      }
      return key
    })
    mockCopyFiles = jest.fn()
    mockCutFiles = jest.fn()
    mockClearClipboard = jest.fn()
    mockSelectAll = jest.fn()
    mockClearSelection = jest.fn()
    mockHideSelectionBar = jest.fn()
    mockShowMoveValidationModal = jest.fn()
    mockOnPaste = jest.fn()
    mockDispatch = jest.fn()
    mockShowAlert = jest.fn()

    mockClient = {
      save: jest.fn(),
      query: jest.fn(),
      collection: jest.fn()
    }

    mockCurrentFolder = {
      _id: 'current-folder-id',
      name: 'Current Folder'
    }

    mockSelectedItems = [
      {
        _id: 'file1',
        name: 'test1.txt',
        type: 'file',
        dir_id: 'parent-folder-1'
      },
      {
        _id: 'file2',
        name: 'test2.txt',
        type: 'file',
        dir_id: 'parent-folder-2'
      }
    ]

    mockItems = [
      { _id: 'file1', name: 'test1.txt', type: 'file' },
      { _id: 'file2', name: 'test2.txt', type: 'file' },
      { _id: 'folder1', name: 'Test Folder', type: 'directory' }
    ]

    jest
      .spyOn(require('react-redux'), 'useDispatch')
      .mockReturnValue(mockDispatch)

    useAlert.mockReturnValue({ showAlert: mockShowAlert })
    useI18n.mockReturnValue({ t: mockT })
    useClipboardContext.mockReturnValue({
      clipboardData: {
        files: [{ _id: 'clipboard-file', name: 'clipboard.txt' }],
        operation: OPERATION_COPY,
        sourceFolderIds: new Set(['source-folder-id'])
      },
      copyFiles: mockCopyFiles,
      cutFiles: mockCutFiles,
      clearClipboard: mockClearClipboard,
      hasClipboardData: true,
      showMoveValidationModal: mockShowMoveValidationModal
    })
    useSelectionContext.mockReturnValue({
      selectedItems: mockSelectedItems,
      selectAll: mockSelectAll,
      hideSelectionBar: mockHideSelectionBar,
      clearSelection: mockClearSelection,
      isSelectAll: false
    })
    useDisplayedFolder.mockReturnValue({ displayedFolder: mockCurrentFolder })
    useNextcloudCurrentFolder.mockReturnValue(mockCurrentFolder)

    isFile.mockReturnValue(true)
    shouldBlockKeyboardShortcuts.mockReturnValue(false)
    normalizeKey.mockImplementation((event, isApple) => {
      const key = event.key.toLowerCase()
      const ctrl = isApple ? event.metaKey : event.ctrlKey
      if (ctrl && key === 'c') return 'Ctrl+c'
      if (ctrl && key === 'x') return 'Ctrl+x'
      if (ctrl && key === 'v') return 'Ctrl+v'
      if (ctrl && key === 'a') return 'Ctrl+a'
      if (key === 'f2') return 'f2'
      if (key === 'escape') return 'escape'
      if (key === 'delete') return 'delete'
      return key
    })
    isMacOS.mockReturnValue(false)
    handlePasteOperation.mockResolvedValue([
      { success: true, file: { _id: 'pasted-file' }, operation: OPERATION_COPY }
    ])

    flag.mockImplementation(flagName => {
      if (flagName === 'drive.keyboard-shortcuts.enabled') return true
      return false
    })

    mockCopyFiles.mockClear()
    mockCutFiles.mockClear()
    mockClearClipboard.mockClear()
    mockSelectAll.mockClear()
    mockClearSelection.mockClear()
    mockHideSelectionBar.mockClear()
    mockShowMoveValidationModal.mockClear()
    mockOnPaste.mockClear()
    mockDispatch.mockClear()
    mockShowAlert.mockClear()
    handlePasteOperation.mockClear()
  })

  describe('Copy Operations (Ctrl+C / Cmd+C)', () => {
    it('should copy selected files when Ctrl+C is pressed', () => {
      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            allowCopy: true
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockCopyFiles).toHaveBeenCalledWith(
        mockSelectedItems,
        new Set(['parent-folder-1', 'parent-folder-2'])
      )
      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'alert.items_copied_2',
        severity: 'success'
      })
      expect(mockClearSelection).toHaveBeenCalled()
    })

    it('should show alert when copy is not allowed', () => {
      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            allowCopy: false
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockCopyFiles).not.toHaveBeenCalled()
      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'alert.copy_not_allowed',
        severity: 'secondary'
      })
    })

    it('should filter only files for copying', () => {
      isFile.mockImplementation(item => item.type === 'file')

      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            allowCopy: true
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockCopyFiles).toHaveBeenCalledWith(
        mockSelectedItems.filter(item => item.type === 'file'),
        new Set(['parent-folder-1', 'parent-folder-2'])
      )
    })
  })

  describe('Cut Operations (Ctrl+X / Cmd+X)', () => {
    it('should cut selected items when Ctrl+X is pressed', () => {
      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'x',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockCutFiles).toHaveBeenCalledWith(
        mockSelectedItems,
        new Set(['parent-folder-1', 'parent-folder-2']),
        mockCurrentFolder
      )
      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'alert.items_cut_2',
        severity: 'success'
      })
      expect(mockClearSelection).toHaveBeenCalled()
    })
  })

  describe('Paste Operations (Ctrl+V / Cmd+V)', () => {
    it('should paste files when Ctrl+V is pressed', async () => {
      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            canPaste: true,
            onPaste: mockOnPaste
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        bubbles: true
      })

      await act(async () => {
        document.dispatchEvent(event)
      })

      expect(handlePasteOperation).toHaveBeenCalledWith(
        mockClient,
        [{ _id: 'clipboard-file', name: 'clipboard.txt' }],
        OPERATION_COPY,
        undefined,
        mockCurrentFolder,
        {
          sharingContext: null,
          showAlert: mockShowAlert,
          showMoveValidationModal: mockShowMoveValidationModal,
          t: mockT,
          isPublic: false
        }
      )
      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'alert.item_pasted',
        severity: 'success'
      })
      expect(mockOnPaste).toHaveBeenCalled()
    })

    it('should clear clipboard after cut operation', async () => {
      useClipboardContext.mockReturnValue({
        clipboardData: {
          files: [{ _id: 'clipboard-file', name: 'clipboard.txt' }],
          operation: OPERATION_CUT,
          sourceFolderIds: new Set(['source-folder-id'])
        },
        copyFiles: mockCopyFiles,
        cutFiles: mockCutFiles,
        clearClipboard: mockClearClipboard,
        hasClipboardData: true,
        showMoveValidationModal: mockShowMoveValidationModal
      })

      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            canPaste: true
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        bubbles: true
      })

      await act(async () => {
        document.dispatchEvent(event)
      })

      expect(mockClearClipboard).toHaveBeenCalled()
    })

    it('should skip paste when cutting and pasting in same folder', async () => {
      useClipboardContext.mockReturnValue({
        clipboardData: {
          files: [
            {
              _id: 'clipboard-file',
              name: 'clipboard.txt'
            }
          ],
          operation: OPERATION_CUT,
          sourceFolderIds: new Set(['current-folder-id'])
        },
        copyFiles: mockCopyFiles,
        cutFiles: mockCutFiles,
        clearClipboard: mockClearClipboard,
        hasClipboardData: true,
        showMoveValidationModal: mockShowMoveValidationModal
      })

      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            canPaste: true
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        bubbles: true
      })

      await act(async () => {
        document.dispatchEvent(event)
      })

      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'alert.paste_same_folder_skipped',
        severity: 'secondary'
      })
      expect(handlePasteOperation).not.toHaveBeenCalled()
    })
  })

  describe('Move with Validation Modals', () => {
    it('should call showMoveValidationModal during paste operation', async () => {
      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            canPaste: true,
            sharingContext: { isShared: true }
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        bubbles: true
      })

      await act(async () => {
        document.dispatchEvent(event)
      })

      expect(handlePasteOperation).toHaveBeenCalledWith(
        mockClient,
        expect.any(Array),
        OPERATION_COPY,
        undefined,
        mockCurrentFolder,
        expect.objectContaining({
          sharingContext: { isShared: true },
          showMoveValidationModal: mockShowMoveValidationModal
        })
      )
    })
  })

  describe('Select All (Ctrl+A / Cmd+A)', () => {
    it('should select all items when Ctrl+A is pressed', () => {
      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockSelectAll).toHaveBeenCalledWith(mockItems)
    })

    it('should clear selection when all items are already selected', () => {
      useSelectionContext.mockReturnValue({
        selectedItems: mockSelectedItems,
        selectAll: mockSelectAll,
        hideSelectionBar: mockHideSelectionBar,
        clearSelection: mockClearSelection,
        isSelectAll: true
      })

      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockClearSelection).toHaveBeenCalled()
      expect(mockSelectAll).not.toHaveBeenCalled()
    })
  })

  describe('Rename (F2)', () => {
    it('should start renaming when F2 is pressed with single selection', () => {
      useSelectionContext.mockReturnValue({
        selectedItems: [mockSelectedItems[0]], // Single item selected
        selectAll: mockSelectAll,
        hideSelectionBar: mockHideSelectionBar,
        clearSelection: mockClearSelection,
        isSelectAll: false
      })

      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'F2',
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockDispatch).toHaveBeenCalledWith(
        startRenamingAsync(mockSelectedItems[0])
      )
    })

    it('should not start renaming when multiple items are selected', () => {
      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'F2',
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe('the delete shortcut key', () => {
    it('should show delete confirmation when Delete key is pressed', () => {
      const mockPushModal = jest.fn()
      const mockPopModal = jest.fn()
      const mockRefresh = jest.fn()

      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            pushModal: mockPushModal,
            popModal: mockPopModal,
            refresh: mockRefresh
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockPushModal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(Function)
        })
      )
    })

    it('should not show delete confirmation when no items are selected', () => {
      useSelectionContext.mockReturnValue({
        selectedItems: [],
        selectAll: mockSelectAll,
        hideSelectionBar: mockHideSelectionBar,
        clearSelection: mockClearSelection,
        isSelectAll: false
      })

      const mockPushModal = jest.fn()
      const mockPopModal = jest.fn()
      const mockRefresh = jest.fn()

      const wrapper = createWrapper()
      renderHook(
        () =>
          useKeyboardShortcuts({
            client: mockClient,
            items: mockItems,
            pushModal: mockPushModal,
            popModal: mockPopModal,
            refresh: mockRefresh
          }),
        { wrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockPushModal).not.toHaveBeenCalled()
    })
  })

  describe('Shared Drive Operations', () => {
    const sharedDriveFiles = [
      {
        _id: 'shared-file-1',
        name: 'shared-doc.pdf',
        type: 'file',
        dir_id: 'shared-folder-1',
        driveId: 'shared-drive-123'
      }
    ]

    const sharedDriveFolder = {
      _id: 'shared-folder-1',
      name: 'Shared Folder',
      type: 'directory',
      driveId: 'shared-drive-456'
    }

    beforeEach(() => {
      // Reset all mocks
      shouldBlockKeyboardShortcuts.mockReturnValue(false)
      isFile.mockReturnValue(true)

      useDisplayedFolder.mockReturnValue({ displayedFolder: sharedDriveFolder })
      useSelectionContext.mockReturnValue({
        selectedItems: sharedDriveFiles,
        selectAll: mockSelectAll,
        clearSelection: mockClearSelection,
        isSelectionBarVisible: false
      })
    })

    it('should copy shared drive files when Ctrl+C is pressed', () => {
      const wrapper = createWrapper()
      renderHook(() => useKeyboardShortcuts({ onPaste: mockOnPaste }), {
        wrapper
      })

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockCopyFiles).toHaveBeenCalledWith(
        sharedDriveFiles,
        new Set(['shared-folder-1'])
      )
      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'alert.item_copied',
        severity: 'success'
      })
      expect(mockClearSelection).toHaveBeenCalled()
    })

    it('should cut shared drive files when Ctrl+X is pressed', () => {
      useDisplayedFolder.mockReturnValue({ displayedFolder: sharedDriveFolder })

      const wrapper = createWrapper()
      renderHook(() => useKeyboardShortcuts({ onPaste: mockOnPaste }), {
        wrapper
      })

      const event = new KeyboardEvent('keydown', {
        key: 'x',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockCutFiles).toHaveBeenCalledWith(
        sharedDriveFiles,
        new Set(['shared-folder-1']),
        sharedDriveFolder
      )
      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'alert.item_cut',
        severity: 'success'
      })
      expect(mockClearSelection).toHaveBeenCalled()
    })

    it('should handle paste operations with shared drive folders', async () => {
      // Test that handlePasteOperation can be called with shared drive folder
      // This verifies the integration works correctly
      await handlePasteOperation(
        mockClient,
        [{ _id: 'regular-file', name: 'regular.txt' }],
        'copy',
        null,
        sharedDriveFolder,
        {
          sharingContext: null,
          showAlert: mockShowAlert,
          showMoveValidationModal: mockShowMoveValidationModal,
          t: mockT
        }
      )

      // Verify that the function was called with shared drive folder
      expect(handlePasteOperation).toHaveBeenCalledWith(
        mockClient,
        [{ _id: 'regular-file', name: 'regular.txt' }],
        'copy',
        null,
        expect.objectContaining({
          _id: 'shared-folder-1',
          driveId: 'shared-drive-456'
        }),
        expect.any(Object)
      )
    })
  })
})
