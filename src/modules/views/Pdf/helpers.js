import flag from 'cozy-flags'

export const PDF_MIME = 'application/pdf'

/**
 * Checks whether a file is a PDF. Uses the cozy file class (which the viewer
 * also keys on) and falls back to the mime type.
 *
 * @param {object} file - An io.cozy.files document
 * @returns {boolean}
 */
export const isPdf = file => file?.class === 'pdf' || file?.mime === PDF_MIME

/**
 * Checks whether the PDF editor feature is enabled through the flag.
 *
 * @returns {boolean}
 */
export const isPdfEditorEnabled = () =>
  flag('drive.pdf-editor.enabled') === true

/**
 * @typedef {Object} PdfRouteOptions
 * @property {string} [driveId] Id of the shared drive the file belongs to
 * @property {string} [fromPathname] Hash to redirect the user when he comes back
 * @property {boolean} [fromPublicFolder] The document is opened from a public folder
 */

/**
 * Builds the in-app route to open a PDF in the editor.
 *
 * @param {string} fileId - Id of the PDF file
 * @param {PdfRouteOptions} [options] - Options
 * @returns {string} Path to the PDF editor
 */
export const makePdfRoute = (
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
    return `/pdf/${driveId}/${fileId}${searchParam}`
  }

  return `/pdf/${fileId}${searchParam}`
}
