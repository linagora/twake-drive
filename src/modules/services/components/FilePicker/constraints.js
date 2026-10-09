import mimeTypes from 'mime-types'

import { models } from 'cozy-client'

import { matchMimeType } from '@/components/FilePicker/helpers'

export { matchMimeType }

export function getDownloadLinkDisabledState(actionConfig, selectedItems) {
  const items = [].concat(selectedItems ?? [])
  // Folder archives cannot be size-validated before attachment generation.
  if (actionConfig && items.some(item => fileModel.isDirectory(item))) {
    return {
      disabled: true,
      reasonKey: 'FilePicker.constraints.disabledReasons.folderNotAllowed'
    }
  }
  return getActionDisabledState(actionConfig, selectedItems)
}

const { file: fileModel } = models

const getFileMime = file => {
  const mime = file?.mime || mimeTypes.lookup(file?.name)

  return mime || null
}

/**
 * Compute whether an action button should be disabled for a given
 * selected item, and the reason key to surface in a tooltip.
 *
 * First matching rule wins. The function is pure: no i18n, no DOM.
 * The caller resolves reasonKey against the locale.
 *
 * Rules (in order):
 * 1. No action config -> disabled, no reason.
 * 2. When accept is supplied, every selected item must match it; the
 *    deprecated folder and MIME filters are ignored, including for [].
 *    Otherwise, selected item is a folder and the action disallows folders ->
 *    FilePicker.constraints.disabledReasons.folderNotAllowed.
 * 3. Selected item is a file whose mime is not in the action's
 *    allowedMimeTypes (when that list is non-empty) ->
 *    FilePicker.constraints.disabledReasons.mimeTypeNotAllowed.
 * 4. Selected item is a file whose size is invalid -> disabled, no reason.
 * 5. Selected item is a file larger than the action's maxFileSize ->
 *    FilePicker.constraints.disabledReasons.fileTooLarge.
 * 6. Selected items count exceeds the action's maxFileCount ->
 *    FilePicker.constraints.disabledReasons.maxFileCountExceeded.
 * 7. Total selected file size exceeds the action's availableSize ->
 *    FilePicker.constraints.disabledReasons.availableSizeExceeded.
 * 8. Otherwise -> enabled.
 *
 * @param {object|null|undefined} actionConfig
 * @param {object|object[]|null|undefined} selectedItems - Cozy file/folder doc(s).
 * @returns {{ disabled: boolean, reasonKey: string|null }}
 */
export const getActionDisabledState = (actionConfig, selectedItems) => {
  if (!actionConfig) {
    return { disabled: true, reasonKey: null }
  }

  const items = [].concat(selectedItems ?? [])
  const hasAccept = actionConfig.accept !== undefined

  for (const selectedItem of items) {
    if (hasAccept) {
      const accept = actionConfig.accept
      const isFolder = fileModel.isDirectory(selectedItem)
      const accepted =
        Array.isArray(accept) &&
        (isFolder
          ? accept.includes('folder')
          : fileModel.isFile(selectedItem) &&
            (accept.includes('file') ||
              matchMimeType(getFileMime(selectedItem), accept)))
      if (!accepted) {
        return {
          disabled: true,
          reasonKey: isFolder
            ? 'FilePicker.constraints.disabledReasons.folderNotAllowed'
            : 'FilePicker.constraints.disabledReasons.mimeTypeNotAllowed'
        }
      }
    }
    if (selectedItem && fileModel.isDirectory(selectedItem)) {
      if (!hasAccept && actionConfig.allowFolder === false) {
        return {
          disabled: true,
          reasonKey: 'FilePicker.constraints.disabledReasons.folderNotAllowed'
        }
      }
      continue
    }

    if (selectedItem && fileModel.isFile(selectedItem)) {
      const allowedMimeTypes = actionConfig.allowedMimeTypes
      if (
        !hasAccept &&
        Array.isArray(allowedMimeTypes) &&
        allowedMimeTypes.length > 0 &&
        !matchMimeType(getFileMime(selectedItem), allowedMimeTypes)
      ) {
        return {
          disabled: true,
          reasonKey: 'FilePicker.constraints.disabledReasons.mimeTypeNotAllowed'
        }
      }

      const rawFileSize = selectedItem.size
      const fileSize =
        typeof rawFileSize === 'number' || typeof rawFileSize === 'string'
          ? Number(rawFileSize)
          : NaN
      if (
        (typeof rawFileSize === 'string' && rawFileSize.trim() === '') ||
        !Number.isFinite(fileSize) ||
        fileSize < 0
      ) {
        return { disabled: true, reasonKey: null }
      }

      const maxFileSize = actionConfig.maxFileSize
      if (typeof maxFileSize === 'number' && fileSize > maxFileSize) {
        return {
          disabled: true,
          reasonKey: 'FilePicker.constraints.disabledReasons.fileTooLarge'
        }
      }
    }
  }

  const maxFileCount = actionConfig.maxFileCount
  if (typeof maxFileCount === 'number' && items.length > maxFileCount) {
    return {
      disabled: true,
      reasonKey: 'FilePicker.constraints.disabledReasons.maxFileCountExceeded'
    }
  }

  const availableSize = actionConfig.availableSize
  if (typeof availableSize === 'number') {
    let totalSize = 0
    for (const selectedItem of items) {
      if (selectedItem && fileModel.isFile(selectedItem)) {
        totalSize += Number(selectedItem.size)
      }
    }

    if (totalSize > availableSize) {
      return {
        disabled: true,
        reasonKey:
          'FilePicker.constraints.disabledReasons.availableSizeExceeded'
      }
    }
  }

  return { disabled: false, reasonKey: null }
}
