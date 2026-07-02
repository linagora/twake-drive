import mimeTypes from 'mime-types'

import { isDirectory, isFile } from 'cozy-client/dist/models/file'

/**
 * @param {string} types - Types we wish to accept ("folder" and/or "extensions/mime" of file), separated by commas
 * @returns {string[]} All the valid types, if the parameter is undefined or if no type is valid, return an empty array
 */
export const getCompliantTypes = types => {
  if (types) {
    return types
      .replaceAll(' ', '')
      .split(',')
      .filter(type =>
        type !== 'folder' ? !!mimeTypes.contentType(type) : true
      )
  }

  return []
}

/**
 * Check if Item is a file with accepted extension/mime
 *
 * @param {object} item - file or folder
 * @param {string[]} validTypes - List of accepted types
 * @returns {boolean}
 */
export const isValidFile = (item, validTypes) => {
  const fileTypesAccepted =
    validTypes.includes(`.${item.name.split('.').pop()}`) ||
    validTypes.includes(item.mime)

  return isFile(item) && (fileTypesAccepted || validTypes.length === 0)
}

/**
 * Check if Item is a folder with accepted type
 *
 * @param {object} item - file or folder
 * @param {string[]} validTypes - List of accepted types
 * @returns {boolean}
 */
export const isValidFolder = (item, validTypes) => {
  return isDirectory(item) && validTypes.includes(`folder`)
}
