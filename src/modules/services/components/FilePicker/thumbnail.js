import { matchMimeType } from './helpers'

const MIME_TYPE_TO_THUMBNAIL_TYPE = {
  // Audio
  'audio/*': 'audio',

  // Image
  'image/*': 'image',

  // Video
  'video/*': 'video',

  // PDF
  'application/pdf': 'pdf',

  // PowerPoint
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow':
    'powerpoint',

  // Excel
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template':
    'excel',

  // Word
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'word',
  'application/vnd.ms-word.document.macroEnabled.12': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template':
    'word',

  // OpenDocument
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',

  // Archive
  'application/zip': 'archive',
  'application/x-zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/x-rar': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/gzip': 'archive',
  'application/x-gzip': 'archive',
  'application/x-bzip2': 'archive',
  'application/x-xz': 'archive',
  'application/x-tar': 'archive',
  'application/x-7z-compressed': 'archive',

  // Code
  'application/x-shellscript': 'code',
  'application/x-sh': 'code',
  'application/javascript': 'code',
  'text/javascript': 'code',
  'application/json': 'code',
  'application/x-yaml': 'code',
  'text/x-yaml': 'code',
  'text/x-java-source': 'code',
  'text/x-python': 'code',
  'text/x-ruby': 'code',
  'text/x-perl': 'code',
  'text/x-php': 'code',
  'text/x-c': 'code',
  'text/x-c++': 'code',
  'text/x-objective-c': 'code',
  'text/x-swift': 'code',
  'text/x-go': 'code',
  'text/x-rust': 'code',
  'text/x-typescript': 'code',

  // Text
  'text/*': 'text',

  // Default
  '*/*': 'default'
}

const THUMBNAIL_TYPE_TO_THUMBNAIL_LINK = {
  audio: 'https://files.twake.app/email-assets/file-picker/audio.png',
  image: 'https://files.twake.app/email-assets/file-picker/image.png',
  video: 'https://files.twake.app/email-assets/file-picker/video.png',
  pdf: 'https://files.twake.app/email-assets/file-picker/pdf.png',
  powerpoint: 'https://files.twake.app/email-assets/file-picker/powerpoint.png',
  excel: 'https://files.twake.app/email-assets/file-picker/excel.png',
  word: 'https://files.twake.app/email-assets/file-picker/word.png',
  odt: 'https://files.twake.app/email-assets/file-picker/odt.png',
  ods: 'https://files.twake.app/email-assets/file-picker/ods.png',
  odp: 'https://files.twake.app/email-assets/file-picker/odp.png',
  archive: 'https://files.twake.app/email-assets/file-picker/archive.png',
  code: 'https://files.twake.app/email-assets/file-picker/code.png',
  text: 'https://files.twake.app/email-assets/file-picker/text.png',
  default: 'https://files.twake.app/email-assets/file-picker/default.png'
}

/**
 * Maps a MIME type to its corresponding thumbnail link.
 * @param {string} mimeType - The MIME type to map.
 * @returns {string} - The link of the thumbnail.
 */
function getThumbnailLinkFromMimeType(mimeType) {
  const patterns = Object.keys(MIME_TYPE_TO_THUMBNAIL_TYPE)

  const matchedPattern = patterns.find(pattern =>
    matchMimeType(mimeType, [pattern])
  )

  const thumbnailType = matchedPattern
    ? MIME_TYPE_TO_THUMBNAIL_TYPE[matchedPattern]
    : 'default'

  return THUMBNAIL_TYPE_TO_THUMBNAIL_LINK[thumbnailType]
}

export const makeThumbnail = file => {
  try {
    return {
      thumbnail: {
        link: getThumbnailLinkFromMimeType(file.mime)
      }
    }
  } catch {
    return {}
  }
}
