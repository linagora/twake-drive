import React, { useEffect, useCallback } from 'react'
import { useDispatch } from 'react-redux'

import { isFile } from 'cozy-client/dist/models/file'
import CozyClient from 'cozy-client/types/CozyClient'
import { IOCozyFile } from 'cozy-client/types/types'
import flag from 'cozy-flags'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { shouldBlockKeyboardShortcuts, normalizeKey } from './helpers'

import { isMacOS } from '@/components/pushClient'
import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import {
  useClipboardContext,
  OPERATION_CUT
} from '@/contexts/ClipboardProvider'
import { useDisplayedFolder } from '@/hooks'
import DeleteConfirm from '@/modules/drive/DeleteConfirm'
import { startRenamingAsync } from '@/modules/drive/rename'
import { useNextcloudCurrentFolder } from '@/modules/nextcloud/hooks/useNextcloudCurrentFolder'
import { handlePasteOperation } from '@/modules/paste'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

// Type for the result returned by copy/move operations from cozy-client
interface PasteResultFile {
  data?: IOCozyFile
  moved?: IOCozyFile
}

interface PasteOperationResult {
  success: boolean
  file: PasteResultFile | IOCozyFile
  error?: Error
  operation: string
}

interface UseKeyboardShortcutsProps {
  onPaste?: (() => void) | null
  canPaste?: boolean
  client?: CozyClient | null
  items?: IOCozyFile[]
  sharingContext?: unknown
  allowCopy?: boolean
  allowCut?: boolean
  isNextCloudFolder?: boolean
  isPublic?: boolean
  pushModal?: (modal: React.ReactElement) => void
  popModal?: () => void
  refresh?: () => void
}

export const useKeyboardShortcuts = ({
  onPaste = null,
  canPaste = false,
  client = null,
  items = [],
  sharingContext = null,
  allowCopy = true,
  allowCut = true,
  isNextCloudFolder = false,
  isPublic = false,
  pushModal,
  popModal,
  refresh
}: UseKeyboardShortcutsProps): void => {
  const dispatch = useDispatch()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const {
    selectedItems,
    selectAll,
    hideSelectionBar,
    clearSelection,
    isSelectAll
  } = useSelectionContext() as unknown as {
    selectedItems: IOCozyFile[]
    selectAll: (items: IOCozyFile[]) => void
    hideSelectionBar: () => void
    clearSelection: () => void
    isSelectAll: boolean
  }
  const {
    clipboardData,
    copyFiles,
    cutFiles,
    clearClipboard,
    hasClipboardData,
    showMoveValidationModal
  } = useClipboardContext()
  const { addItems } = useNewItemHighlightContext() as {
    addItems: (items: IOCozyFile[]) => void
  }

  const { displayedFolder } = useDisplayedFolder()
  const currentNextCloudFolder = useNextcloudCurrentFolder()
  const currentFolder = isNextCloudFolder
    ? currentNextCloudFolder
    : displayedFolder

  const isApple = isMacOS()

  const handleCopy = useCallback(() => {
    if (!allowCopy) {
      showAlert({ message: t('alert.copy_not_allowed'), severity: 'secondary' })
      return
    }

    const parentFolderIds = selectedItems.map(item => item.dir_id)
    if (parentFolderIds.includes(SHARED_DRIVES_DIR_ID)) {
      showAlert({
        message: t('alert.cannot_copy_shared_drive'),
        severity: 'secondary'
      })
      return
    }

    if (!selectedItems.length) return

    const filesToCopy = selectedItems.filter(isFile)
    if (filesToCopy.length === 0) {
      showAlert({ message: t('alert.copy_files_only'), severity: 'secondary' })
      return
    }

    copyFiles(filesToCopy, new Set(parentFolderIds))
    const message =
      filesToCopy.length === 1
        ? t('alert.item_copied')
        : t('alert.items_copied', { count: filesToCopy.length })
    showAlert({ message, severity: 'success' })
    clearSelection()
  }, [allowCopy, selectedItems, copyFiles, showAlert, t, clearSelection])

  const handleCut = useCallback(() => {
    if (!selectedItems.length) return

    if (!allowCut) {
      showAlert({
        message: t('alert.cut_not_allowed'),
        severity: 'secondary'
      })
      return
    }

    const parentFolderIds = selectedItems.map(item => item.dir_id)

    if (parentFolderIds.includes(SHARED_DRIVES_DIR_ID)) {
      showAlert({
        message: t('alert.cannot_move_shared_drive'),
        severity: 'secondary'
      })
      return
    }

    cutFiles(
      selectedItems,
      new Set(parentFolderIds),
      currentFolder as IOCozyFile
    )
    const message =
      selectedItems.length === 1
        ? t('alert.item_cut')
        : t('alert.items_cut', { count: selectedItems.length })
    showAlert({ message, severity: 'success' })
    clearSelection()
  }, [
    selectedItems,
    allowCut,
    currentFolder,
    cutFiles,
    t,
    showAlert,
    clearSelection
  ])

  const handlePaste = useCallback(async () => {
    if (!hasClipboardData || !client || !currentFolder) return

    if (!canPaste) {
      showAlert({
        message: t('alert.paste_not_allowed'),
        severity: 'secondary'
      })
      return
    }

    // Skip operation if cutting and pasting in the same folder
    if (
      clipboardData.operation === OPERATION_CUT &&
      clipboardData.sourceFolderIds?.has(currentFolder._id)
    ) {
      showAlert({
        message: t('alert.paste_same_folder_skipped'),
        severity: 'secondary'
      })
      return
    }

    try {
      const results = (await handlePasteOperation(
        client,
        clipboardData.files,
        clipboardData.operation,
        clipboardData.sourceDirectory,
        currentFolder,
        {
          showAlert,
          t,
          sharingContext,
          showMoveValidationModal,
          isPublic
        }
      )) as PasteOperationResult[]

      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      if (successCount > 0) {
        const message =
          successCount === 1
            ? t('alert.item_pasted')
            : t('alert.items_pasted', { count: successCount })
        showAlert({ message, severity: 'success' })

        const successfulFiles = results
          .filter(r => r.success)
          .map(r => {
            const file = r.file
            if ('data' in file && file.data) {
              return file.data
            }
            if ('moved' in file && file.moved) {
              return file.moved
            }
            return null
          })
          .filter((file): file is IOCozyFile => file !== null)

        if (successfulFiles.length > 0) {
          addItems(successfulFiles)
        }
      } else if (failureCount > 0) {
        showAlert({
          message: t('alert.paste_failed'),
          severity: 'error'
        })
      }

      if (clipboardData.operation === OPERATION_CUT) {
        clearClipboard()
      }

      onPaste?.()
    } catch (error) {
      showAlert({
        message: t('alert.paste_error'),
        severity: 'error'
      })
    }
  }, [
    hasClipboardData,
    client,
    currentFolder,
    canPaste,
    clipboardData.operation,
    clipboardData.sourceFolderIds,
    clipboardData.files,
    clipboardData.sourceDirectory,
    showAlert,
    t,
    sharingContext,
    showMoveValidationModal,
    isPublic,
    onPaste,
    clearClipboard,
    addItems
  ])

  const handleSelectAll = useCallback(() => {
    isSelectAll ? clearSelection() : selectAll(items)
  }, [isSelectAll, clearSelection, selectAll, items])

  const handleRename = useCallback(() => {
    if (selectedItems.length === 1) {
      dispatch(startRenamingAsync(selectedItems[0]))
    }
  }, [selectedItems, dispatch])

  const handleEscape = useCallback(() => {
    hideSelectionBar()
    clearClipboard()
  }, [hideSelectionBar, clearClipboard])

  const handleDelete = useCallback(() => {
    if (!selectedItems.length || !pushModal || !popModal || !refresh) return

    const driveId = selectedItems[0]?.driveId

    pushModal(
      <DeleteConfirm
        files={selectedItems}
        afterConfirmation={refresh}
        onClose={popModal}
        driveId={driveId}
      />
    )
  }, [selectedItems, pushModal, popModal, refresh])

  useEffect(() => {
    if (!flag('drive.keyboard-shortcuts.enabled')) {
      return
    }

    const shortcuts: Record<string, (() => void | Promise<void>) | undefined> =
      {
        'Ctrl+c': handleCopy,
        'Ctrl+x': handleCut,
        'Ctrl+v': handlePaste,
        'Ctrl+a': handleSelectAll,
        f2: handleRename,
        escape: handleEscape,
        delete: handleDelete
      }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.target || shouldBlockKeyboardShortcuts(event.target)) return

      const combo = normalizeKey(event, isApple)
      const handler = shortcuts[combo]

      if (handler) {
        event.preventDefault()
        void handler()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    isApple,
    handleCopy,
    handleCut,
    handlePaste,
    handleSelectAll,
    handleRename,
    handleEscape,
    handleDelete
  ])
}
