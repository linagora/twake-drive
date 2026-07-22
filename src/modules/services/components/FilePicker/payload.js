import { models } from 'cozy-client'

const { file: fileModel } = models

import { makeThumbnail } from './thumbnail'

/**
 * Build a single file entry of the File Picker payload from a
 * Cozy file/folder document and the links generated for it.
 *
 * `links` is an object that may contain `sharingLink` (public link)
 * and/or `downloadLink` (temporary link) depending on the chosen
 * generation mode. A reference entry contains neither link.
 *
 * @param {object} file  - io.cozy.files document
 * @param {object} links - Generated links
 * @param {string} [links.sharingLink] - Public sharing link
 * @param {string} [links.downloadLink] - Temporary download link
 * @param {boolean} [links.reference] - Return a plain document reference
 * @returns {{id: string, name: string, size: number, mimeType: string|null, sharingLink?: string, downloadLink?: string, type?: string, doctype?: string}}
 */
export const makeFilePickerFileEntry = (
  file,
  { sharingLink, downloadLink, reference } = {}
) => ({
  id: file._id,
  name: file.name,
  size: fileModel.isFile(file) ? parseInt(file.size, 10) || 0 : 0,
  mimeType: fileModel.isFile(file) ? file.mime : null,
  ...(sharingLink ? { sharingLink } : {}),
  ...(downloadLink ? { downloadLink } : {}),
  ...makeThumbnail(file),
  ...(reference ? { type: file.type, doctype: 'io.cozy.files' } : {})
})
