import mimeTypes from 'mime-types'

import { isFile } from 'cozy-client/dist/models/file'

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
// ('image/*'), or the global wildcard ('*/*'). Matching is
// case-insensitive, as MIME types are per RFC 2045.
export const matchMimePattern = (mime, pattern) => {
  const m = mime.toLowerCase()
  const p = pattern.toLowerCase()
  if (p === '*/*' || p === m) return true
  const [pType, pSubtype] = p.split('/')
  const [type] = m.split('/')
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
