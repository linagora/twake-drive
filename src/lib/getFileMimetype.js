import mime from 'mime-types'

import { isFileType } from './fileTypes'

const getMimetypeFromFilename = name => {
  return mime.lookup(name) || 'application/octet-stream'
}

const FILE_TYPE_BY_MIME_SUBTYPE = {
  word: 'text',
  text: 'text',
  zip: 'zip',
  pdf: 'pdf',
  spreadsheet: 'sheet',
  excel: 'sheet',
  sheet: 'sheet',
  presentation: 'slide',
  powerpoint: 'slide'
}

export const getFileMimetype = (mime = '', name = '') => {
  const mimetype =
    mime === 'application/octet-stream'
      ? getMimetypeFromFilename(name.toLowerCase())
      : mime
  const [type, subtype] = mimetype.split('/')

  if (isFileType(type)) {
    return type
  }

  if (type !== 'application' || !subtype) return null

  const existingType = subtype.match(
    Object.keys(FILE_TYPE_BY_MIME_SUBTYPE).join('|')
  )
  return existingType ? FILE_TYPE_BY_MIME_SUBTYPE[existingType[0]] : null
}
