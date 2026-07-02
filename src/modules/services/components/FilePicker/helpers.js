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

// Check whether a single mime type matches a single pattern.
// Patterns may be exact ('image/png'), a subtype wildcard
// ('image/*'), or the global wildcard ('*/*').
const matchMimePattern = (mime, pattern) => {
  if (pattern === '*/*' || pattern === mime) return true
  const [pType, pSubtype] = pattern.split('/')
  const [type] = mime.split('/')
  return pSubtype === '*' && pType === type
}

// Match a mime type against a list of patterns. Supports wildcards
// on the subtype (e.g. 'image/*') and the global wildcard ('*/*').
export const matchMimeType = (mime, patterns) => {
  if (!mime || !Array.isArray(patterns) || patterns.length === 0) {
    return false
  }
  return patterns.some(pattern => matchMimePattern(mime, pattern))
}

/**
 * Check if Item is a file with accepted extension/mime
 *
 * @param {object} item - file or folder
 * @param {string[]} validTypes - List of accepted types
 * @returns {boolean}
 */
export const isValidFile = (item, validTypes) => {
  if (!isFile(item)) return false
  if (validTypes.length === 0) return true

  const extension = `.${item.name.split('.').pop()}`.toLowerCase()
  const mime = item.mime?.toLowerCase()

  return validTypes.some(type => {
    const normalized = type.toLowerCase()
    if (normalized === extension) return true
    if (mime && matchMimePattern(mime, normalized)) return true
    return false
  })
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
