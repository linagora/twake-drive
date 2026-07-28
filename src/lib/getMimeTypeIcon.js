import {
  FileTypeAudio,
  FileTypeBin,
  FileTypeCode,
  FileTypeFiles,
  FileTypeFolder,
  FileTypeImage,
  FileTypeNote,
  FileTypePdf,
  FileTypeSheet,
  FileTypeSlide,
  FileTypeText,
  FileTypeVideo,
  FileTypeZip
} from '@linagora/twake-icons'
import get from 'lodash/get'

import IconDocs from '@/assets/icons/icon-docs.svg'
import IconExcalidraw from '@/assets/icons/icon-excalidraw.svg'
import { getFileMimetype } from '@/lib/getFileMimetype'

export const MIME_TYPE_ICONS = {
  audio: FileTypeAudio,
  bin: FileTypeBin,
  code: FileTypeCode,
  image: FileTypeImage,
  pdf: FileTypePdf,
  sheet: FileTypeSheet,
  slide: FileTypeSlide,
  text: FileTypeText,
  video: FileTypeVideo,
  zip: FileTypeZip
}

/**
 * Returns the appropriate icon for a given file based on its mime type.
 *
 * @param {boolean} isDirectory
 * @param {string} name
 * @param {string} mime
 * @returns {import('react').ReactNode}
 */
const getMimeTypeIcon = (isDirectory, name, mime) => {
  if (isDirectory) {
    return FileTypeFolder
  } else if (/\.cozy-note$/.test(name)) {
    return FileTypeNote
  } else if (/\.docs-note$/.test(name)) {
    return IconDocs
  } else if (/\.excalidraw$/.test(name)) {
    return IconExcalidraw
  } else {
    const type = getFileMimetype(mime, name)
    return get(MIME_TYPE_ICONS, type, FileTypeFiles)
  }
}

export default getMimeTypeIcon
