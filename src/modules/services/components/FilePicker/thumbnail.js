import { matchMimeType } from './helpers'

const MIME_TYPE_TO_THUMBNAIL_TYPE = {
  // Audio
  'audio/*': 'audio',

  // Image
  'image/*': 'image',

  // PDF
  'application/pdf': 'pdf',

  // Word
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'word',

  // Default
  '*/*': 'default'
}

const THUMBNAIL_TYPE_TO_THUMBNAIL_LINK = {
  audio: 'https://files.twake.app/email-assets/file-picker/audio.png',
  image: 'https://files.twake.app/email-assets/file-picker/image.png',
  pdf: 'https://files.twake.app/email-assets/file-picker/pdf.png',
  word: 'https://files.twake.app/email-assets/file-picker/word.png',
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
