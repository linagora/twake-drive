import { Q } from 'cozy-client'
import { isFile } from 'cozy-client/dist/models/file'

/**
 * Extracts the base name, extension, and existing suffix from a file/folder name.
 * Handles numbered suffixes in parentheses and file extensions.
 *
 * @example
 * parseName("file (2).txt", true) => { base: "file", extension: ".txt", suffix: 2 }
 * parseName("folder (3)", false) => { base: "folder", extension: "", suffix: 3 }
 * parseName("document.pdf", true) => { base: "document", extension: ".pdf", suffix: null }
 *
 * @param {string} name - The file or folder name to parse
 * @param {boolean} isFileItem - Whether the item is a file (true) or folder (false)
 * @returns {Object} Object containing base name, extension, and suffix
 * @returns {string} returns.base - The base name without extension or suffix
 * @returns {string} returns.extension - The file extension (empty for folders)
 * @returns {number|null} returns.suffix - The numeric suffix if present, null otherwise
 */
const parseName = (name, isFileItem) => {
  let base = name
  let extension = ''
  let suffix = null

  if (isFileItem) {
    const lastDotIndex = name.lastIndexOf('.')
    if (lastDotIndex > 0) {
      base = name.substring(0, lastDotIndex)
      extension = name.substring(lastDotIndex)
    }
  }

  const match = base.match(/^(.*)\s\((\d+)\)$/)
  if (match) {
    base = match[1]
    suffix = parseInt(match[2], 10)
  }

  return { base, extension, suffix }
}

/**
 * Generates a unique name not present in the given set of existing names.
 * Appends numbered suffixes in parentheses until a unique name is found.
 *
 * @example
 * generateUniqueNameWithSuffix("file.txt", new Set(["file.txt"]), true)
 * // Returns: "file (1).txt"
 *
 * generateUniqueNameWithSuffix("folder (2)", new Set(["folder (2)", "folder (3)"]), false)
 * // Returns: "folder (4)"
 *
 * @param {string} originalName - The original name to make unique
 * @param {Set<string>} existingNames - Set of names that already exist
 * @param {boolean} isFileItem - Whether the item is a file (true) or folder (false)
 * @returns {string} A unique name not present in existingNames
 */
export const generateUniqueNameWithSuffix = (
  originalName,
  existingNames,
  isFileItem
) => {
  if (!existingNames.has(originalName)) {
    return originalName
  }

  const { base, extension, suffix } = parseName(originalName, isFileItem)

  let counter = suffix ? suffix + 1 : 1
  let newName

  do {
    newName = `${base} (${counter})${extension}`
    counter++
  } while (existingNames.has(newName))

  return newName
}

/**
 * Gets all existing items in a target folder to check for conflicts.
 * Queries for all non-trashed files and folders in the specified directory.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {import('cozy-client/types/types').IOCozyFile} targetFolder - The target folder object
 * @param {string} targetFolder._id - The folder's unique identifier
 * @returns {Promise<Set<string>>} Set of existing item names in the folder
 * @throws {Error} When targetFolder is invalid or missing _id
 */
export const getExistingItems = async (
  client,
  targetFolder,
  isPublic = false
) => {
  if (!targetFolder || !targetFolder._id) {
    throw new Error('Invalid targetFolder: missing _id')
  }

  if (isPublic) {
    const { included } = await client
      .collection('io.cozy.files')
      .statById(targetFolder._id)
    return new Set(included?.map(item => item.name))
  }

  const query = Q('io.cozy.files')
    .where({
      dir_id: targetFolder._id,
      trashed: false
    })
    .indexFields(['dir_id', 'trashed'])

  const result = await client.query(query)
  const items = result.data || []
  return new Set(items.map(item => item.name))
}

/**
 * Resolves name conflicts by generating unique names for files/folders to be moved.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {Array<import('cozy-client/types/types').IOCozyFile>} files - Array of files/folders to be moved
 * @param {import('cozy-client/types/types').IOCozyFile} targetFolder - The target folder object
 * @param {string} targetFolder._id - The folder's unique identifier
 * @returns {Promise<Array<import('cozy-client/types/types').IOCozyFile & { needsRename?: boolean; uniqueName?: string }>>} Array of files with resolved names and conflict flags
 * @returns {boolean} returns[].needsRename - Whether the file needs to be renamed
 * @returns {string} returns[].uniqueName - The unique name for the file
 * @throws {Error} When files is not an array
 *
 * @example
 * const files = [{ name: "document.pdf", _id: "123" }]
 * const resolved = await resolveNameConflictsForCut(client, files, targetFolder)
 * // If "document.pdf" exists, returns:
 * // [{ name: "document.pdf", uniqueName: "document (1).pdf", needsRename: true, ... }]
 */
export const resolveNameConflictsForCut = async (
  client,
  files,
  targetFolder,
  isPublic = false
) => {
  if (!Array.isArray(files)) {
    throw new Error('files must be an array')
  }

  const existingNames = await getExistingItems(client, targetFolder, isPublic)

  const resolvedFiles = files.map(file => {
    const isFileItem = isFile(file)
    const originalName = file.name
    const uniqueName = generateUniqueNameWithSuffix(
      originalName,
      existingNames,
      isFileItem
    )

    // update the set so subsequent files don’t clash
    existingNames.add(uniqueName)

    return {
      ...file,
      needsRename: originalName !== uniqueName,
      uniqueName,
      attributes: {
        ...file.attributes,
        name: uniqueName
      }
    }
  })

  return resolvedFiles
}
