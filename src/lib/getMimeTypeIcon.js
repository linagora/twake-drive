import get from 'lodash/get'

import IconAudio from 'cozy-ui/transpiled/react/Icons/FileTypeAudio'
import IconBin from 'cozy-ui/transpiled/react/Icons/FileTypeBin'
import IconCode from 'cozy-ui/transpiled/react/Icons/FileTypeCode'
import IconFiles from 'cozy-ui/transpiled/react/Icons/FileTypeFiles'
import IconFolder from 'cozy-ui/transpiled/react/Icons/FileTypeFolder'
import IconImage from 'cozy-ui/transpiled/react/Icons/FileTypeImage'
import IconNote from 'cozy-ui/transpiled/react/Icons/FileTypeNote'
import IconPdf from 'cozy-ui/transpiled/react/Icons/FileTypePdf'
import IconSheet from 'cozy-ui/transpiled/react/Icons/FileTypeSheet'
import IconSlide from 'cozy-ui/transpiled/react/Icons/FileTypeSlide'
import IconText from 'cozy-ui/transpiled/react/Icons/FileTypeText'
import IconVideo from 'cozy-ui/transpiled/react/Icons/FileTypeVideo'
import IconZip from 'cozy-ui/transpiled/react/Icons/FileTypeZip'

import IconDocs from '@/assets/icons/icon-docs.svg'
import { getFileMimetype } from '@/lib/getFileMimetype'

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
    return IconFolder
  } else if (/\.cozy-note$/.test(name)) {
    return IconNote
  } else if (/\.docs-note$/.test(name)) {
    return IconDocs
  } else {
    const iconsByMimeType = {
      audio: IconAudio,
      bin: IconBin,
      code: IconCode,
      image: IconImage,
      pdf: IconPdf,
      slide: IconSlide,
      sheet: IconSheet,
      text: IconText,
      video: IconVideo,
      zip: IconZip
    }
    const type = getFileMimetype(iconsByMimeType)(mime, name)
    return get(iconsByMimeType, type, IconFiles)
  }
}

export default getMimeTypeIcon
