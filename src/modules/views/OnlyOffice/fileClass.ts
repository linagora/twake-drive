import { lookup } from 'mime-types'

export type OnlyOfficeFileClass = 'text' | 'spreadsheet' | 'slide'
export type CozyFileClass = OnlyOfficeFileClass | 'audio' | 'image' | 'video'

// `mime-types` ships without typings in this repo, so `lookup` arrives as
// `any`. Pin the call signature once at the boundary so callers can rely on
// `string | false` without sprinkling casts.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const lookupMime: (name: string) => string | false = lookup

// The stack stores io.cozy.files.class on real file docs, but /drives sharing
// rules expose only the root file MIME. cozy-client currently checks class but
// does not expose a MIME-to-class helper, so shared-drive file shortcuts need
// this small local bridge to keep OnlyOffice routing working.
export const ONLY_OFFICE_CLASS_BY_MIME: Record<string, OnlyOfficeFileClass> = {
  'application/msword': 'text',
  'application/vnd.oasis.opendocument.text': 'text',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'text',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'spreadsheet',
  'application/vnd.ms-powerpoint': 'slide',
  'application/vnd.oasis.opendocument.presentation': 'slide',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'slide'
}

export const getOnlyOfficeClassFromMime = (
  mime?: string
): OnlyOfficeFileClass | undefined =>
  mime ? ONLY_OFFICE_CLASS_BY_MIME[mime] : undefined

const COZY_CLASS_BY_MIME_CATEGORY: Record<string, CozyFileClass> = {
  audio: 'audio',
  image: 'image',
  text: 'text',
  video: 'video'
}

export const getFileClassFromMime = (
  mime?: string
): CozyFileClass | undefined => {
  if (!mime) return undefined

  return (
    getOnlyOfficeClassFromMime(mime) ||
    COZY_CLASS_BY_MIME_CATEGORY[mime.split('/')[0]]
  )
}

export const getMimeFromName = (name?: string): string | undefined => {
  const mime = name ? lookupMime(name) : false

  return mime || undefined
}

export const getFileClassFromMimeOrName = ({
  mime,
  name
}: {
  mime?: string
  name?: string
}): CozyFileClass | undefined =>
  getFileClassFromMime(mime) || getFileClassFromMime(getMimeFromName(name))
