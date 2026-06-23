import flag from 'cozy-flags'

import { makeEditorFileRoute } from '@/modules/views/editor/helpers'

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
 * Builds the in-app route to open a PDF in the editor.
 *
 * @param {string} fileId - Id of the PDF file
 * @param {import('@/modules/views/editor/helpers').EditorRouteOptions} [options]
 * @returns {string} Path to the PDF editor
 */
export const makePdfRoute = (fileId, options) =>
  makeEditorFileRoute('pdf', fileId, options)
