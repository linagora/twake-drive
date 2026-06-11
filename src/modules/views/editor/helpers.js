/**
 * @typedef {Object} EditorRouteOptions
 * @property {string} [driveId] Id of the shared drive the file belongs to
 * @property {string} [fromPathname] Hash to redirect the user to when he comes back
 * @property {boolean} [fromPublicFolder] The document is opened from a public folder
 */

/**
 * Builds the in-app route to open a file in an editor mounted at `/${slug}`.
 *
 * @param {string} slug - The editor route prefix (e.g. "pdf", "excalidraw")
 * @param {string} fileId - Id of the file
 * @param {EditorRouteOptions} [options]
 * @returns {string}
 */
export const makeEditorFileRoute = (
  slug,
  fileId,
  { driveId, fromPathname, fromPublicFolder = false } = {}
) => {
  const params = new URLSearchParams()
  if (fromPathname) {
    params.append('redirectLink', `drive#${fromPathname}`)
  }
  if (fromPublicFolder) {
    params.append('fromPublicFolder', fromPublicFolder)
  }

  const searchParam = params.size > 0 ? `?${params.toString()}` : ''

  if (driveId) {
    return `/${slug}/${driveId}/${fileId}${searchParam}`
  }

  return `/${slug}/${fileId}${searchParam}`
}

/**
 * Writes the edited content back to the file binary, scoped to the shared drive
 * when the file belongs to one.
 *
 * @param {object} client - cozy-client
 * @param {object} file - The io.cozy.files document being edited
 * @param {Blob|string|ArrayBuffer} content - The content to persist
 * @param {string} contentType - The MIME type to store
 */
export const updateFileBinary = (client, file, content, contentType) =>
  client
    .collection('io.cozy.files', file.driveId ? { driveId: file.driveId } : {})
    .updateFile(content, {
      fileId: file._id,
      name: file.name,
      contentType
    })
