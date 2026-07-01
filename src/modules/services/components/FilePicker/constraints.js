import mimeTypes from 'mime-types'

import { models } from 'cozy-client'

const { file: fileModel } = models

// TODO with multi selection: enforce maxFileCount and availableSize.

/**
 * Match a mime type against a list of patterns. Supports wildcards
 * on the subtype (e.g. image plus star) and the global wildcard
 * (star plus slash plus star). An exact match counts as well.
 *
 * @param {string} mime - The mime type to test.
 * @param {string[]} patterns - The patterns to match against.
 * @returns {boolean} True if the mime matches at least one pattern.
 */
const getFileMime = file => {
  const mime =
    file?.mime ||
    file?.mimeType ||
    file?.attributes?.mime ||
    file?.attributes?.mimeType ||
    mimeTypes.lookup(file?.name)

  return mime || null
}

export const matchMimeType = (mime, patterns) => {
  if (!mime || !Array.isArray(patterns) || patterns.length === 0) {
    return false
  }
  const slashIndex = mime.indexOf('/')
  if (slashIndex < 0) return false
  const type = mime.substring(0, slashIndex)

  return patterns.some(pattern => {
    if (pattern === '*/*') return true
    if (pattern === mime) return true
    const pSlash = pattern.indexOf('/')
    if (pSlash < 0) return false
    const pType = pattern.substring(0, pSlash)
    const pSubtype = pattern.substring(pSlash + 1)
    if (pSubtype === '*' && pType === type) return true
    return false
  })
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
 * @param {object|null|undefined} selectedItem - Cozy file/folder doc.
 * @returns {{ disabled: boolean, reasonKey: string|null }}
 */
export const getActionDisabledState = (actionConfig, selectedItem) => {
  if (!actionConfig) {
    return { disabled: true, reasonKey: null }
  }

  if (selectedItem && fileModel.isDirectory(selectedItem)) {
    if (actionConfig.allowFolder === false) {
      return {
        disabled: true,
        reasonKey: 'FilePicker.constraints.disabledReasons.folderNotAllowed'
      }
    }
    return { disabled: false, reasonKey: null }
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

  return { disabled: false, reasonKey: null }
}
