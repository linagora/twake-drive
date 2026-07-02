import mimeTypes from 'mime-types'

import { models } from 'cozy-client'

import { matchMimeType } from './helpers'

export { matchMimeType }

const { file: fileModel } = models

// TODO with multi selection: enforce maxFileCount and availableSize.

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
 * 2. Selected item is a folder and the action disallows folders ->
 *    FilePicker.constraints.disabledReasons.folderNotAllowed.
 * 3. Selected item is a file whose mime is not in the action's
 *    allowedMimeTypes (when that list is non-empty) ->
 *    FilePicker.constraints.disabledReasons.mimeTypeNotAllowed.
 * 4. Selected item is a file larger than the action's maxFileSize ->
 *    FilePicker.constraints.disabledReasons.fileTooLarge.
 * 5. Otherwise -> enabled.
 *
 * @param {object|null|undefined} actionConfig
 * @param {object|object[]|null|undefined} selectedItems - Cozy file/folder doc(s).
 * @returns {{ disabled: boolean, reasonKey: string|null }}
 */
export const getActionDisabledState = (actionConfig, selectedItems) => {
  if (!actionConfig) {
    return { disabled: true, reasonKey: null }
  }

  const items = selectedItems == null ? [] : [].concat(selectedItems)

  for (const selectedItem of items) {
    if (selectedItem && fileModel.isDirectory(selectedItem)) {
      if (actionConfig.allowFolder === false) {
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
        Array.isArray(allowedMimeTypes) &&
        allowedMimeTypes.length > 0 &&
        !matchMimeType(getFileMime(selectedItem), allowedMimeTypes)
      ) {
        return {
          disabled: true,
          reasonKey: 'FilePicker.constraints.disabledReasons.mimeTypeNotAllowed'
        }
      }

      const maxFileSize = actionConfig.maxFileSize
      if (
        typeof maxFileSize === 'number' &&
        Number(selectedItem.size) > maxFileSize
      ) {
        return {
          disabled: true,
          reasonKey: 'FilePicker.constraints.disabledReasons.fileTooLarge'
        }
      }
    }
  }

  return { disabled: false, reasonKey: null }
}
